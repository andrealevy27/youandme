import { db } from "../db";
import { analyticsEvents } from "../db/schema";
import { env } from "../env";
import { logger } from "../logger";
import type { AnalyticsEvent } from "@/lib/analytics-events";

type Props = Record<string, string | number | boolean | null | undefined>;

interface AnalyticsSink {
  capture(event: AnalyticsEvent, userId: string | null, props: Props): Promise<void>;
}

/** First-party sink: every event lands in Postgres so admin analytics never depend on a vendor. */
const databaseSink: AnalyticsSink = {
  async capture(event, userId, props) {
    await db.insert(analyticsEvents).values({ name: event, userId, properties: props });
  },
};

const posthogSink: AnalyticsSink | null =
  env.POSTHOG_KEY && env.POSTHOG_HOST
    ? {
        async capture(event, userId, props) {
          await fetch(`${env.POSTHOG_HOST}/capture/`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ api_key: env.POSTHOG_KEY, event, distinct_id: userId ?? "anonymous", properties: props }),
          });
        },
      }
    : null;

const sinks = [databaseSink, ...(posthogSink ? [posthogSink] : [])];

/** Fire-and-forget tracking. Failures are logged, never surfaced to users. */
export function track(event: AnalyticsEvent, userId: string | null, props: Props = {}) {
  void Promise.all(
    sinks.map((s) =>
      s.capture(event, userId, props).catch((err) => logger.warn("analytics_capture_failed", { event, err })),
    ),
  );
}
