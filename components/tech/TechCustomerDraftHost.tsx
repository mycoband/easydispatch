'use client';

import { useState } from 'react';
import {
  CustomerTextDraftSheet,
  type CustomerDraftContext,
  type CustomerDraftMode,
} from '@/components/messages/CustomerTextDraftSheet';
import { TimeTrackingPanel } from '@/components/jobs/TimeTrackingPanel';
import type { JobTimeFields } from '@/lib/jobs/time-tracking';

/**
 * Tech time panel + confirm-to-send OMW/Done sheets after Drive Start / Clock Out.
 */
export function TechCustomerDraftHost({
  jobId,
  job,
  hasPhone,
  draftContext,
  enableDrafts,
  offlineQueue = false,
  large = false,
}: {
  jobId: string;
  job: JobTimeFields;
  hasPhone: boolean;
  draftContext: CustomerDraftContext;
  /** Messaging module + messaging permission */
  enableDrafts: boolean;
  offlineQueue?: boolean;
  large?: boolean;
}) {
  const [mode, setMode] = useState<CustomerDraftMode | null>(null);

  return (
    <>
      <TimeTrackingPanel
        jobId={jobId}
        job={job}
        large={large}
        offlineQueue={offlineQueue}
        onAfterDrive={enableDrafts ? () => setMode('omw') : undefined}
        onAfterClockOut={enableDrafts ? () => setMode('done') : undefined}
      />
      {enableDrafts && (
        <CustomerTextDraftSheet
          open={mode != null}
          mode={mode}
          jobId={jobId}
          hasPhone={hasPhone}
          context={draftContext}
          onClose={() => setMode(null)}
        />
      )}
    </>
  );
}
