import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "../shared/auth/public.decorator";
import { PlatformSettingsService } from "./platform-settings.service";

/** Same shape as packages/api-contract/src/app-config.ts (the API doesn't import the contract package). */
interface AppConfig {
  analytics: { reaskDays: number };
  links: { hoodoraAiStudio: string | null };
}

/**
 * The admin-set rules the apps follow (docs/api-contract.md). Public: the website's /ai address asks
 * before anyone signs in, and nothing here is about a person.
 */
@ApiTags("platform")
@Controller("app-config")
export class PlatformController {
  constructor(private readonly settings: PlatformSettingsService) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: "App settings set by admins",
    description:
      "How many days before the app asks again someone who said no to usage analytics (0: never), and the AI Studio address when myHoodora AI links should go there (null: our own /ai page).",
  })
  async get(): Promise<AppConfig> {
    const { analyticsReaskDays, hoodoraAi } = await this.settings.get();
    return {
      analytics: { reaskDays: analyticsReaskDays },
      links: { hoodoraAiStudio: hoodoraAi.target === "studio" ? hoodoraAi.studioUrl : null },
    };
  }
}
