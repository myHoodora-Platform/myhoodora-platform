import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PlatformSettingsService } from "./platform-settings.service";

/** Same shape as packages/api-contract/src/app-config.ts (the API doesn't import the contract package). */
interface AppConfig {
  analytics: { reaskDays: number };
}

/** The admin-set rules the apps follow, for any signed-in member (docs/api-contract.md). */
@ApiTags("platform")
@ApiBearerAuth()
@Controller("app-config")
export class PlatformController {
  constructor(private readonly settings: PlatformSettingsService) {}

  @Get()
  @ApiOperation({ summary: "App settings set by admins", description: "Today: how many days before the app asks again someone who said no to usage analytics (0: never)." })
  async get(): Promise<AppConfig> {
    const { analyticsReaskDays } = await this.settings.get();
    return { analytics: { reaskDays: analyticsReaskDays } };
  }
}
