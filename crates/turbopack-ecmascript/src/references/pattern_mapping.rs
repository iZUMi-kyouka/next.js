use std::collections::HashMap;

use anyhow::Result;
use swc_ecma_ast::Expr;
use swc_ecma_quote::quote;
use turbo_tasks::{Value, ValueToString};
use turbopack_core::{
    chunk::ModuleId,
    resolve::{ResolveResult, ResolveResultVc},
};

use crate::{utils::module_id_to_lit, EcmascriptChunkContextVc, EcmascriptChunkPlaceableVc};

/// A mapping from a request pattern (e.g. "./module", `./images/${name}.png`)
/// to corresponding module ids. The same pattern can map to multiple module ids
/// at runtime when using variable interpolation.
#[turbo_tasks::value]
pub(crate) enum PatternMapping {
    /// Invalid request.
    Invalid,
    /// Constant request that always maps to the same module.
    ///
    /// ### Example
    /// ```js
    /// require("./module")
    /// ```
    Single(ModuleId),
    /// Variable request that can map to different modules at runtime.
    ///
    /// ### Example
    /// ```js
    /// require(`./images/${name}.png`)
    /// ```
    Map(HashMap<String, ModuleId>),
}

#[derive(PartialOrd, Ord, Hash, Debug, Copy, Clone)]
#[turbo_tasks::value(serialization: auto_for_input)]
pub(crate) enum ResolveType {
    EsmAsync,
    Cjs,
}

impl PatternMapping {
    pub fn create(&self) -> Expr {
        match self {
            PatternMapping::Invalid => {
                // TODO improve error message
                quote!("(() => {throw new Error(\"Invalid\")})()" as Expr)
            }
            PatternMapping::Single(module_id) => module_id_to_lit(module_id),
            PatternMapping::Map(_) => {
                todo!("emit an error for this case: Complex expression can't be transformed");
            }
        }
    }

    pub fn apply(&self, _key_expr: Expr) -> Expr {
        // TODO handle PatternMapping::Map
        self.create()
    }
}

#[turbo_tasks::value_impl]
impl PatternMappingVc {
    /// Resolves a request into a pattern mapping.
    // NOTE(alexkirsz) I would rather have used `resolve` here but it's already reserved by the Vc
    // impl.
    #[turbo_tasks::function]
    pub async fn resolve_request(
        chunk_context: EcmascriptChunkContextVc,
        resolve_result: ResolveResultVc,
        resolve_type: Value<ResolveType>,
    ) -> Result<PatternMappingVc> {
        let result = resolve_result.await?;
        let asset = match &*result {
            ResolveResult::Alternatives(assets, _) => {
                if let Some(asset) = assets.first() {
                    asset
                } else {
                    return Ok(PatternMappingVc::cell(PatternMapping::Invalid));
                }
            }
            ResolveResult::Single(asset, _) => asset,
            _ => {
                // TODO implement mapping
                println!(
                    "the reference resolves to a non-trivial result, which is not supported yet: \
                     {:?}",
                    &*result
                );
                return Ok(PatternMappingVc::cell(PatternMapping::Invalid));
            }
        };

        if let Some(placeable) = EcmascriptChunkPlaceableVc::resolve_from(asset).await? {
            let name = if *resolve_type == ResolveType::EsmAsync {
                chunk_context.helper_id("chunk loader", Some(*asset))
            } else {
                chunk_context.id(placeable)
            }
            .await?;
            Ok(PatternMappingVc::cell(PatternMapping::Single(name.clone())))
        } else {
            println!(
                "asset {} is not placeable in ESM chunks, so it doesn't have a module id",
                asset.path().to_string().await?
            );
            Ok(PatternMappingVc::cell(PatternMapping::Invalid))
        }
    }
}
