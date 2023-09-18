import type { ManifestLoader } from '../../manifests/loaders/manifest-loader'
import type { AppRouteRouteDefinition } from '../app-route-route-definition'
import type { PagesManifest } from '../../../../build/webpack/plugins/pages-manifest-plugin'

import { isAppRouteRoute } from '../../../../lib/is-app-route-route'
import { APP_PATHS_MANIFEST } from '../../../../shared/lib/constants'
import { AppFilenameNormalizer } from '../../normalizers/built/app/app-filename-normalizer'
import { AppRouteRouteDefinitionBuilder } from '../builders/app-route-route-definition-builder'
import { ManifestRouteDefinitionProvider } from './helpers/manifest-route-definition-provider'
import { RouteKind } from '../../route-kind'

type AppManifests = { [APP_PATHS_MANIFEST]: PagesManifest }

export class AppRouteRouteDefinitionProvider extends ManifestRouteDefinitionProvider<
  AppRouteRouteDefinition,
  AppManifests
> {
  public readonly kind = RouteKind.APP_ROUTE
  private readonly normalizer: AppFilenameNormalizer

  constructor(
    distDir: string,
    private readonly pageExtensions: ReadonlyArray<string>,
    manifestLoader: ManifestLoader<AppManifests>
  ) {
    super(APP_PATHS_MANIFEST, manifestLoader)

    this.normalizer = new AppFilenameNormalizer(distDir)
  }

  protected transform(
    manifest: PagesManifest
  ): ReadonlyArray<AppRouteRouteDefinition> {
    // The manifest consists of a map of all the pages to their bundles. Let's
    // filter out all the pages that are not app routes.
    const pages = Object.keys(manifest).filter((page) => isAppRouteRoute(page))

    const builder = new AppRouteRouteDefinitionBuilder(this.pageExtensions)
    for (const page of pages) {
      const filename = this.normalizer.normalize(manifest[page])

      builder.add({ page, filename })
    }

    return builder.build()
  }
}
