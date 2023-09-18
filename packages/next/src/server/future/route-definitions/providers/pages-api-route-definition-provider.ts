import type { PagesAPIRouteDefinition } from '../pages-api-route-definition'
import type { PagesManifest } from '../../../../build/webpack/plugins/pages-manifest-plugin'
import type { ManifestLoader } from '../../manifests/loaders/manifest-loader'
import type { PagesManifests } from '../../manifests/manifests'

import { isAPIRoute } from '../../../../lib/is-api-route'
import { PAGES_MANIFEST } from '../../../../shared/lib/constants'
import { ManifestRouteDefinitionProvider } from './helpers/manifest-route-definition-provider'
import { PagesFilenameNormalizer } from '../../normalizers/built/pages/pages-filename-normalizer'
import { PagesAPIRouteDefinitionBuilder } from '../builders/pages-api-route-definition-builder'
import { RouteKind } from '../../route-kind'

export class PagesAPIRouteDefinitionProvider extends ManifestRouteDefinitionProvider<
  PagesAPIRouteDefinition,
  PagesManifests
> {
  public readonly kind = RouteKind.PAGES_API
  private readonly normalizer: PagesFilenameNormalizer

  constructor(
    distDir: string,
    private readonly pageExtensions: ReadonlyArray<string>,
    manifestLoader: ManifestLoader<PagesManifests>
  ) {
    super(PAGES_MANIFEST, manifestLoader)

    this.normalizer = new PagesFilenameNormalizer(distDir)
  }

  protected transform(
    manifest: PagesManifest
  ): ReadonlyArray<PagesAPIRouteDefinition> {
    // The manifest consists of a map of all the pages to their bundles. Let's
    // filter out all the pages that are API pages.
    const pages = Object.keys(manifest).filter((page) => isAPIRoute(page))

    const builder = new PagesAPIRouteDefinitionBuilder(this.pageExtensions)
    for (const page of pages) {
      const filename = this.normalizer.normalize(manifest[page])

      builder.add({ page, filename })
    }

    return builder.build()
  }
}
