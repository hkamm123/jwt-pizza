# Incident: 2026-11-25 19-14-25

## Summary

Between 19:14 and 19:42 UTC (12:14 to 12:42 PM MT) on 2026-11-25, every pizza order placed on JWT Pizza failed. Diners who tried to pay got the error "Failed to fulfill order at factory" and received no pizza. The cause was a chaos test that the pizza factory (pizza-factory.cs329.click) started on our vendor account: for every order, the factory returned HTTP 500 `{"message":"chaos monkey"}`, and jwt-pizza-service passed that on to diners as a 500. The chaos had been requested ahead of time as part of the chaos testing deliverable.

The incident was detected by two Grafana alerts ("JWT Pizza HTTP 5xx errors" and "JWT Pizza factory failures"), which paged the on-call engineer through Grafana OnCall about 2.5 minutes after the first failure. The engineer found the factory's error response in the Loki factory logs, followed the support link the factory included (`reportUrl`), and the factory ended the chaos. This was a high-severity incident: the core purchase flow was 100% down for about 28 minutes. Browsing the menu, logging in, and other features were not affected.

## Detection

The incident was detected at 19:16 UTC when two Grafana alert rules fired and Grafana OnCall paged the on-call engineer (Hyrum Kammerman):

- **JWT Pizza HTTP 5xx errors**: Loki count of `level="error"` HTTP logs over 5 minutes > 1
- **JWT Pizza factory failures**: Prometheus `sum(increase(pizza_creation_failures_total[5m])) > 0`

Both rules went Pending at 19:15:20 UTC, fired at 19:16:20 UTC after their 1-minute pending period, and OnCall sent the pages at 19:16:51 and 19:16:54 UTC. Time to detection was **2 min 26 s** from the first failed order (19:14:25 UTC).

Alert tuning done before the incident (2026-11-24 evening, MT) made this detection work:

- The 5xx rule was changed from `[1m] > 3` to `[5m] > 1` to match real traffic (about 1 order per minute, 5xx baseline of 0).
- The factory failures rule window was changed from 1m to 5m. With 1 order per minute, a 1-minute window flickers and never clears the 1-minute pending period.

## Impact

For about 28 minutes between 19:14:25 and 19:42:00 UTC on 2026-11-25, no diner could buy a pizza. Every `POST /api/order` returned HTTP 500 with "Failed to fulfill order at factory".

- **Orders affected:** 39 orders failed, which was 100% of orders placed during the incident. 32 came from the simulated-traffic diner account and 7 from the on-call engineer's own test orders. No real customers were affected, because all traffic was simulated.
- **Other endpoints:** none affected. All 39 server errors in the window were `POST /api/order`. Menu, login, logout, and franchise endpoints kept working normally.
- **Revenue:** no pizzas were sold during the window. The `pizzas_sold` and `pizza_revenue` metrics only count orders the factory accepts.
- **Data side effect:** jwt-pizza-service saves the order to the database (`DB.addDinerOrder`, `orderRouter.js:103`) *before* calling the factory, so the 39 failed orders were still recorded and will appear in diners' order history even though no pizza was made.

## Timeline

All times are UTC (MT = UTC − 7).

- _2026-11-24 04:19 (11-24 21:19 MT)_: On-call engineer clicks "Initiate chaos" on the pizza factory. Traffic script running (about 24 requests/min, about 1 order/min, factory average about 44 ms); all alert rules Normal.
- _2026-11-24 04:21 to 04:23_: Alert tuning: factory failures window 1m → 5m, 5xx rule `[5m] > 1`, "orders stopped" rule added.
- _19:13:33_: Last successful factory order before the incident (order 2281).
- _19:14:25_: **First impact.** `POST /api/order` returns 500; factory responds `500 {"message":"chaos monkey", "reportUrl": ...}`.
- _19:15:20_: Both alert rules go Pending.
- _19:16:20_: Both alert rules go Firing.
- _19:16:51_: OnCall pages for **JWT Pizza HTTP 5xx errors**.
- _19:16:54_: OnCall pages for **JWT Pizza factory failures**.
- _19:22:33_: JWT Pizza factory failures alert acknowledged.
- _19:23:37_: JWT Pizza HTTP 5xx errors alert acknowledged.
- _~19:28_: Root cause found: Loki query `{component="jwt-pizza-service", type="factory", level="error"}` shows every factory response is "chaos monkey" with a `reportUrl`.
- _~19:28 to 19:40_: Engineer confirms the link is legitimate (same host as the service's configured factory URL; the `followLinkToEndChaos` field comes from the course's upstream starter code) and finds the same link in the browser DevTools Network tab (Response of `POST /api/order`).
- _19:41:07_: Last failed order (order 2320).
- _19:41:07 to 19:41:59_: Engineer opens the `reportUrl`; factory replies `{"message":"Problem resolved. Pizza is back on the menu!"}`.
- _19:41:59_: **Impact ends.** First successful order (order 2321, traffic script).
- _19:42:12 to 19:42:14_: 3 manual test orders (2322 to 2324) succeed and verify as `valid`.
- _19:43:53_: JWT Pizza HTTP 5xx errors alert group resolved manually in OnCall.
- _19:44:05_: JWT Pizza factory failures alert group resolved manually in OnCall.
- _19:45:20_: 5xx alert rule returns to Normal on its own.
- _19:46:20_: Factory failures alert rule returns to Normal on its own.

## Response

After the pages at 19:16:51 and 19:16:54 UTC, the on-call engineer (Hyrum Kammerman) acknowledged both alerts in Grafana OnCall at 19:22:33 and 19:23:37 UTC (about 6 minutes after paging). The engineer used an AI assistant (Claude Code, connected to Grafana) to query Loki and Prometheus.

The investigation went straight to the factory logs because both alerts pointed at order creation. The first query of factory error logs showed the root cause at about 19:28 UTC. The next ~13 minutes went to two things before acting: confirming the support link was legitimate, and learning to find the link in the app itself. The engineer found the link labeled "followLinkToEndChaos" in the factory's response in the network tab in the browser's dev tools.

No escalation was needed.

## Root cause

The pizza factory, a third-party dependency, deliberately failed every order for our vendor account as a chaos test, returning HTTP 500 "chaos monkey". jwt-pizza-service has no fallback when the factory fails, so a factory outage becomes a full order outage.

Two things in our own system slowed recovery:

1. The frontend drops the factory's support link. `callEndpoint` (`jwt-pizza/src/service/httpPizzaService.ts:53`) rejects with only `message`, so the payment page shows "Failed to fulfill order at factory" and hides `followLinkToEndChaos`.
2. The alerts don't link to a runbook or to the log query that shows the factory's response.

## Resolution

Service was restored by following the factory's support link (`reportUrl`, returned to clients as `followLinkToEndChaos`), which ended the chaos at the factory. No code, configuration, or infrastructure change was made.

Recovery was confirmed three ways:

- Orders succeeded again from 19:41:59 UTC.
- Three manual test orders at 19:42 UTC succeeded and their JWTs verified as `valid`.
- Factory logs showed only HTTP 200 afterward.

Both alert groups were resolved manually in OnCall at 19:43:53 and 19:44:05 UTC. The alert rules themselves returned to Normal at 19:45:20 and 19:46:20 UTC, 3 to 4 minutes after the fix, because the last failure stayed in their 5-minute windows and rules are evaluated once per minute.

**How to cut time to mitigation in half:** about 13 of the 25 minutes from page to fix were spent after the root cause was known, confirming the link and finding it. A runbook note on the factory alerts ("check the factory error logs and follow `reportUrl`"), plus putting the `reportUrl` in the alert message, would have brought the fix to within a few minutes of acknowledging.

## Prevention

No earlier incident had this root cause. This was the first time the factory failed.

A related exercise on 2026-11-24 (about 14:50 MT) produced similar symptoms (5xx on order routes), but the cause was different: a chaos endpoint we added to jwt-pizza-service ourselves, which failed 50% of order routes. The 5xx alert built for that exercise is the one that caught this incident, and the alert tuning listed under Detection came out of it.

## Action items

1. **Add runbook annotations** to the factory failures and 5xx alerts: the Loki query `{component="jwt-pizza-service", type="factory", level="error"}` and the instruction to follow `reportUrl`. (Owner: Hyrum; Grafana alert rules.)
2. **Put the `reportUrl` in the page.** Add a Loki-based factory alert that extracts `reportUrl` with `| json` so the notification carries the link. (Owner: Hyrum; Grafana alert rules.)
3. **Faster paging:** remove the 1-minute pending period on the factory failures rule. (Owner: Hyrum; Grafana alert rules.)
4. **Don't keep failed orders:** save the order after the factory accepts it, or mark it failed, so failed orders don't appear in diner history (`jwt-pizza-service/src/routes/orderRouter.js:103`). (Owner: Hyrum; no issue created yet.)
