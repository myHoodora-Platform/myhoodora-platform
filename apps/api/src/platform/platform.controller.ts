import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "../shared/auth/public.decorator";
import { PlatformSettingsService } from "./platform-settings.service";
import { SeasonsService, type SeasonView } from "../seasons/seasons.service";

/** Same shape as packages/api-contract/src/app-config.ts (the API doesn't import the contract package). */
interface AppConfig {
  analytics: { reaskDays: number };
  links: { hoodoraAiStudio: string | null };
  updates: Record<"android" | "ios", { latest: string; minimum: string; storeUrl: string | null }>;
  /** The festive season on now, or starting within a day (contract §41); null otherwise. */
  season: SeasonView | null;
  /** "Get the app" prompts on the mobile website (contract §43). */
  appPrompts: { banner: boolean; sheet: boolean; sheetEveryDays: number };
}

/**
 * The admin-set rules the apps follow (docs/api-contract.md). Public: the website's /ai address asks
 * before anyone signs in, and nothing here is about a person.
 */
@ApiTags("platform")
@Controller("app-config")
export class PlatformController {
  constructor(
    private readonly settings: PlatformSettingsService,
    private readonly seasons: SeasonsService,
  ) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: "App settings set by admins",
    description:
      "How many days before the app asks again someone who said no to usage analytics (0: never), and the AI Studio address when myHoodora AI links should go there (null: our own /ai page), and the latest and minimum app store versions per platform (storeUrl null: not in that store yet), and the festive season on now or starting within a day (null: none).",
  })
  async get(): Promise<AppConfig> {
    const { analyticsReaskDays, hoodoraAi, appUpdates, appPrompts } = await this.settings.get();
    const rule = (r: (typeof appUpdates)["android"]) => ({ latest: r.latest, minimum: r.minimum, storeUrl: r.storeUrl || null });
    return {
      analytics: { reaskDays: analyticsReaskDays },
      links: { hoodoraAiStudio: hoodoraAi.target === "studio" ? hoodoraAi.studioUrl : null },
      updates: { android: rule(appUpdates.android), ios: rule(appUpdates.ios) },
      season: await this.seasons.forApps(),
      appPrompts,
    };
  }
}
