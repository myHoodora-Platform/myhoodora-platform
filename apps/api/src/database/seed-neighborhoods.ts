import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { NeighborhoodsService } from "../neighborhoods/neighborhoods.service";
import { neighborhoodSeeds } from "../neighborhoods/seeds/neighborhoods.seed-data";

const logger = new Logger("SeedNeighborhoods");

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn", "log"],
  });

  try {
    const neighborhoodsService = app.get(NeighborhoodsService);

    for (const seed of neighborhoodSeeds) {
      const hood = await neighborhoodsService.upsertByName(seed);
      logger.log(`Upserted "${hood.name}" (${hood._id})`);
    }

    logger.log(`Seeded ${neighborhoodSeeds.length} neighbourhoods.`);
  } finally {
    await app.close();
  }
}

bootstrap()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error("Seeding failed", err);
    process.exit(1);
  });
