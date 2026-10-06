import { Global, Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Job, JobSchema } from "./job.schema";
import { JobsService } from "./jobs.service";

/** Background work that outlives a request (see JobsService). Global: any module can enqueue and register a handler. */
@Global()
@Module({
  imports: [MongooseModule.forFeature([{ name: Job.name, schema: JobSchema }])],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
