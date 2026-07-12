import { JobType, JobPayload } from './constants';
import { JOB_QUEUE } from './constants.provider';

export type JobHandler = (
  payload: JobPayload,
) => Promise<void> | void;

export interface JobDefinition {
  type: JobType;
  handler: JobHandler;
}
