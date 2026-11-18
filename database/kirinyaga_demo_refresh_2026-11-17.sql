\set ON_ERROR_STOP on

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $$
DECLARE
    tenant_matches integer;
    county_matches integer;
BEGIN
    SELECT count(*) INTO tenant_matches FROM tenants WHERE slug = 'geolabs';
    SELECT count(*) INTO county_matches FROM counties WHERE code = 20 AND name = 'Kirinyaga';

    IF tenant_matches <> 1 THEN
        RAISE EXCEPTION 'Expected one geolabs tenant, found %', tenant_matches;
    END IF;
    IF county_matches <> 1 THEN
        RAISE EXCEPTION 'Expected Kirinyaga county code 20, found % matches', county_matches;
    END IF;
END
$$;

-- Remove the single synthetic Kirinyaga placeholder created by the original
-- geography seed. No record outside tenant geolabs and county 20 is touched.
DELETE FROM mentions m
USING tenants t, counties c
WHERE m.tenant_id = t.id
  AND m.county_id = c.id
  AND t.slug = 'geolabs'
  AND c.code = 20
  AND m.source = 'news'
  AND m.external_id = 'seed-8'
  AND m.raw_payload @> '{"seed":true}'::jsonb;

WITH source_items(
    idx, external_id, publisher, body, published_at, source_url,
    constituency_code, ward_code, issue_axis, sentiment_score, classification_confidence
) AS (
    VALUES
    (1, 'kirinyaga-curated-20261117-club-enforcement', 'Citizen Digital',
     '17 Nov 2026 — Kirinyaga security agencies reported that clubs halted adult-themed shows after warnings, while enforcement teams continued seizures of illicit and unsafe alcohol.',
     '2026-11-17T08:55:00+03:00', 'https://citizen.digital/article/kirinyaga-clubs-halt-adult-entertainment-as-county-intensifies-crackdown-n394027',
     NULL, NULL, 'security', 0.22, 0.92),
    (2, 'kirinyaga-curated-20261116-sagana-makutano-crash', 'Citizen Digital',
     '16 Nov 2026 — A woman died and two people were seriously injured in a motorcycle collision near Kwa V on the Sagana–Makutano road in Mwea West; police opened an investigation.',
     '2026-11-16T09:16:00+03:00', 'https://citizen.digital/article/woman-killed-two-others-injured-in-grisly-kirinyaga-road-accident-n393980',
     100, NULL, 'security', -0.88, 0.96),
    (3, 'kirinyaga-curated-20261113-ngurubani-illicit-alcohol', 'Citizen Digital',
     '13 Nov 2026 — Church leaders meeting in Ngurubani called for stronger action against illicit alcohol and drugs, citing harm to families, school attendance and youth safety.',
     '2026-11-13T09:23:00+03:00', 'https://citizen.digital/article/kirinyaga-church-leaders-declare-war-on-drugs-illicit-alcohol-n393841',
     100, NULL, 'security', -0.68, 0.92),
    (4, 'kirinyaga-curated-20261113-child-protection', 'Kagio News',
     '13 Nov 2026 — The County Commissioner reported 174 child-abuse cases and a 15% teenage-pregnancy rate during a Rapid Results Initiative meeting in Kutus, calling for stronger child protection.',
     '2026-11-13T06:00:00+03:00', 'https://www.kagionews.com/2026/11/kirinyaga-alarm-as-174-children-face.html',
     NULL, NULL, 'security', -0.82, 0.88),
    (5, 'kirinyaga-curated-20261111-kimunye-fire', 'Citizen Digital',
     '11 Nov 2026 — A fire in Kimunye, Gichugu, destroyed a church, an office and four chicken houses, killed about 400 chickens and caused losses estimated above KSh4 million.',
     '2026-11-11T10:08:00+03:00', 'https://citizen.digital/article/church-counts-losses-as-fire-razes-buildings-kills-400-chickens-n393700',
     101, NULL, 'infrastructure', -0.81, 0.95),
    (6, 'kirinyaga-curated-20261111-ndia-security-statement', 'Mzalendo / Parliament Hansard',
     '11 Nov 2026 — A Senate statement request raised residents’ concerns about burglary, livestock theft, abductions, muggings and other offences, particularly in Ndia and Mwea West, and requested official incident data and response measures.',
     '2026-11-11T14:00:00+03:00', 'https://mzalendo.com/democracy-tools/hansard/document/3284/',
     102, NULL, 'security', -0.66, 0.90),
    (7, 'kirinyaga-curated-20261110-kalro-rice-seed', 'Government Advertising Agency / KNA',
     '10 Nov 2026 — KALRO’s Mwea Centre began certified-rice-seed expansion on a 65-hectare site, with the current phase targeting better seed availability and improved farmer yields.',
     '2026-11-10T06:00:00+03:00', 'https://www.gaa.go.ke/sites/default/files/2026-11/MyGov%20November%2010%2C%202026.pdf',
     100, NULL, 'agriculture', 0.78, 0.95),
    (8, 'kirinyaga-curated-20261104-county-economy', 'Kenya News Agency',
     '4 Nov 2026 — The Governor’s State of the County address reported that gross county product rose from KSh114.9 billion in 2017 to KSh190.79 billion in 2025, alongside investment in agriculture, health, water and roads.',
     '2026-11-04T06:00:00+03:00', 'https://www.kenyanews.go.ke/kirinyaga-economy-grows-by-66pc-as-county-expands-development-projects/',
     NULL, NULL, 'economy', 0.65, 0.90),
    (9, 'kirinyaga-curated-20261103-health-outcomes', 'The Star',
     '3 Nov 2026 — The State of the County address reported maternal mortality declining from 88 to 49 deaths per 100,000 live births and neonatal mortality falling from 26 to 11 per 1,000 live births.',
     '2026-11-03T14:30:00+03:00', 'https://beta.the-star.co.ke/counties/central/2026-11-03-waigurus-final-report-kirinyaga-halves-maternal-deaths-triples-rice-production',
     NULL, NULL, 'healthcare', 0.72, 0.88),
    (10, 'kirinyaga-curated-20261103-kutus-fire', 'Citizen Digital',
     '3 Nov 2026 — Nine families were displaced after a fire destroyed rental houses in Kutus Mjini; residents called for dedicated firefighting equipment after the response relied on a water bowser.',
     '2026-11-03T08:40:00+03:00', 'https://citizen.digital/article/nine-families-left-homeless-after-fire-destroys-rental-houses-in-kirinyaga-n393220',
     103, NULL, 'infrastructure', -0.76, 0.95),
    (11, 'kirinyaga-curated-20261010-mwea-farm-roads', 'County Government of Kirinyaga',
     '10 Oct 2026 — The county committed machinery and fuel to rehabilitate impassable on-farm roads in the Mwea irrigation scheme to reduce rice transport costs and improve market access.',
     '2026-10-10T09:00:00+03:00', 'https://kirinyaga.go.ke/relief-for-rice-farmers-as-waiguru-commit-to-rehabilitate-on-farm-roads-in-vast-mwea-irrigation-scheme/',
     100, NULL, 'infrastructure', 0.58, 0.90),
    (12, 'kirinyaga-curated-20261005-kangai-seedlings', 'County Government of Kirinyaga',
     '5 Oct 2026 — The Kangai seedlings propagation centre reported capacity for 400,000 certified seedlings and lower planting-material costs for horticulture farmers.',
     '2026-10-05T09:00:00+03:00', 'https://kirinyaga.go.ke/kirinyaga-farmers-reap-big-from-county-seedlings-propagation-center-cuts-costs/',
     100, 497, 'agriculture', 0.72, 0.91),
    (13, 'kirinyaga-curated-20260925-mwea-clean-water', 'Kenya News Agency',
     '25 Sep 2026 — County-reported health data for the Mwea–Makima Water Project showed a 63% decline in diarrhoea cases while clean water reached about 30,000 residents across six Mwea wards.',
     '2026-09-25T06:00:00+03:00', 'https://www.kenyanews.go.ke/from-canal-water-to-clean-taps-mwea-diseases-drop-by-63-per-cent/',
     100, NULL, 'healthcare', 0.80, 0.91),
    (14, 'kirinyaga-curated-20260915-karumandi-dispensary', 'County Government of Kirinyaga',
     '15 Sep 2026 — Kavote Dispensary opened in Karumandi Ward with outpatient, maternal and child health, laboratory, pharmacy and preventive services for an estimated 5,000 residents.',
     '2026-09-15T09:00:00+03:00', 'https://kirinyaga.go.ke/relief-for-karumandi-residents-as-waiguru-opens-new-dispensary/',
     101, 508, 'healthcare', 0.82, 0.93),
    (15, 'kirinyaga-curated-20260901-sagana-industrial-park', 'County Government of Kirinyaga',
     '1 Sep 2026 — Sagana Industrial Park was reported at approximately 94% completion, with electricity, water treatment, internal roads and a bridge among the remaining requirements.',
     '2026-09-01T09:00:00+03:00', 'https://kirinyaga.go.ke/sagana-industrial-park-nears-commissioning-as-state-team-lauds-progress/',
     102, 511, 'economy', 0.64, 0.91),
    (16, 'kirinyaga-curated-20260806-ndia-road-upgrade', 'Kenya News Agency',
     '6 Aug 2026 — The 2.9-kilometre Riamugaa–Kiandangae road upgrade in Ndia neared completion, improving expected access to markets, schools and health services.',
     '2026-08-06T06:00:00+03:00', 'https://www.kenyanews.go.ke/riamugaa-kiandangae-road-upgrade-to-unlock-ndia-economic-potential/',
     102, NULL, 'infrastructure', 0.67, 0.91),
    (17, 'kirinyaga-curated-20260730-tea-buying-centres', 'Kenya News Agency',
     '30 Jul 2026 — Four tea-buying centres under construction in Inoi and Kerugoya wards were expected to reduce post-harvest losses and serve about 1,800 smallholder tea farmers.',
     '2026-07-30T06:00:00+03:00', 'https://www.kenyanews.go.ke/kirinyaga-builds-tea-hubs-to-reduce-post-harvest-losses/',
     103, NULL, 'agriculture', 0.71, 0.91),
    (18, 'kirinyaga-curated-20260707-county-budget', 'People Daily',
     '7 Jul 2026 — The County Assembly approved a KSh7 billion-plus 2026/27 budget including KSh600 million for ward projects, equivalent to KSh30 million for each of Kirinyaga’s 20 wards.',
     '2026-07-07T11:00:00+03:00', 'https://peopledaily.digital/news/kirinyaga-approves-ksh7b-budget-pumps-ksh600m-into-ward-projects',
     NULL, NULL, 'local_leadership', 0.48, 0.89),
    (19, 'kirinyaga-curated-20261118-diabetes-screening', 'The Star',
     '18 Nov 2026 — Kirinyaga health officials reported 9,460 residents diagnosed with diabetes and receiving treatment, including 3,000 also living with hypertension, while expanding screening through 1,222 Community Health Promoters.',
     '2026-11-18T05:12:00+03:00', 'https://the-star.co.ke/counties/central/2026-11-18-kirinyaga-intensifies-screening-as-diabetes-cases-rise-to-9460',
     NULL, NULL, 'healthcare', -0.28, 0.92)
), resolved AS (
    SELECT
        s.*, t.id AS tenant_id, c.id AS county_id,
        co.id AS constituency_id, w.id AS ward_id
    FROM source_items s
    CROSS JOIN tenants t
    CROSS JOIN counties c
    LEFT JOIN constituencies co
      ON co.code = s.constituency_code AND co.county_id = c.id
    LEFT JOIN wards w
      ON w.code = s.ward_code AND w.constituency_id = co.id
    WHERE t.slug = 'geolabs' AND c.code = 20
), inserted AS (
    INSERT INTO mentions (
        tenant_id, county_id, constituency_id, ward_id, source, external_id,
        author_handle, text, language, sheng_detected, engagement_count,
        collected_at, raw_payload
    )
    SELECT
        r.tenant_id, r.county_id, r.constituency_id, r.ward_id, 'news',
        r.external_id, r.publisher, r.body, 'en', false, 0,
        now() - (r.idx || ' seconds')::interval,
        jsonb_build_object(
            'synthetic', false,
            'curation_scope', 'kirinyaga-demo-2026-11-17',
            'source_url', r.source_url,
            'source_published_at', r.published_at,
            'ingested_at', now()
        )
    FROM resolved r
    ON CONFLICT (tenant_id, source, external_id) WHERE external_id IS NOT NULL
    DO UPDATE SET
        county_id = EXCLUDED.county_id,
        constituency_id = EXCLUDED.constituency_id,
        ward_id = EXCLUDED.ward_id,
        author_handle = EXCLUDED.author_handle,
        text = EXCLUDED.text,
        language = EXCLUDED.language,
        sheng_detected = EXCLUDED.sheng_detected,
        engagement_count = EXCLUDED.engagement_count,
        raw_payload = EXCLUDED.raw_payload
    RETURNING id, tenant_id, external_id
)
INSERT INTO sentiment_scores (
    tenant_id, mention_id, issue_axis, score, confidence, model_version
)
SELECT
    i.tenant_id, i.id, s.issue_axis, s.sentiment_score,
    s.classification_confidence, 'curated-source-review-2026-11-17'
FROM inserted i
JOIN source_items s ON s.external_id = i.external_id
ON CONFLICT (mention_id, issue_axis)
DO UPDATE SET
    score = EXCLUDED.score,
    confidence = EXCLUDED.confidence,
    model_version = EXCLUDED.model_version,
    created_at = now();

WITH alert_items(alert_key, severity, category, title, narrative, playbook) AS (
    VALUES
    ('illicit-alcohol', 3, 'public_health_security',
     'Illicit alcohol risk under active enforcement',
     'Citizen Digital reports from 13 and 17 November show continuing concern about illicit alcohol and drugs despite active seizures and enforcement across Kirinyaga.',
     '[{"minute":0,"action":"Confirm the latest enforcement and health-facility incident picture","owner":"Sentry analyst"},{"minute":10,"action":"Map complaints and seizures by constituency","owner":"County desk"},{"minute":20,"action":"Prepare prevention and rehabilitation briefing points","owner":"Communications"}]'::jsonb),
    ('sagana-makutano-road-safety', 3, 'road_safety',
     'Fatal Sagana–Makutano corridor incident',
     'A 16 November collision near Kwa V in Mwea West killed one passenger and seriously injured two people; residents described repeated night-time crashes and police opened an investigation.',
     '[{"minute":0,"action":"Verify police incident and casualty update","owner":"Sentry analyst"},{"minute":10,"action":"Review corridor lighting, bumps and signage complaints","owner":"Infrastructure desk"},{"minute":20,"action":"Prepare a road-safety response note for Mwea West","owner":"County desk"}]'::jsonb),
    ('child-protection', 3, 'child_protection',
     'Child protection indicators require attention',
     'At a 12 November Rapid Results Initiative meeting, the County Commissioner cited 174 child-abuse cases and a 15% teenage-pregnancy rate and called for stronger parental, community and security action.',
     '[{"minute":0,"action":"Confirm the Children’s Office reporting period and definitions","owner":"Research analyst"},{"minute":10,"action":"Map referral and support capacity by sub-county","owner":"Social policy desk"},{"minute":20,"action":"Prepare a safeguarding-first public response","owner":"Communications"}]'::jsonb),
    ('fire-response', 2, 'emergency_response',
     'Fire response capacity questioned after two incidents',
     'November fires in Kutus Mjini and Kimunye displaced nine families and caused major property and poultry losses; residents publicly questioned access to dedicated firefighting equipment.',
     '[{"minute":0,"action":"Confirm current fire-service assets and station coverage","owner":"Infrastructure desk"},{"minute":10,"action":"Map November incidents and response times","owner":"County desk"},{"minute":20,"action":"Draft an emergency-response capacity brief","owner":"Operations"}]'::jsonb)
)
INSERT INTO alerts (
    id, tenant_id, county_id, severity, category, title, narrative, status, playbook
)
SELECT
    md5('kirinyaga-curated-alert:' || a.alert_key)::uuid,
    t.id, c.id, a.severity, a.category, a.title, a.narrative, 'open', a.playbook
FROM alert_items a
CROSS JOIN tenants t
CROSS JOIN counties c
WHERE t.slug = 'geolabs' AND c.code = 20
ON CONFLICT (id)
DO UPDATE SET
    county_id = EXCLUDED.county_id,
    severity = EXCLUDED.severity,
    category = EXCLUDED.category,
    title = EXCLUDED.title,
    narrative = EXCLUDED.narrative,
    playbook = EXCLUDED.playbook,
    updated_at = now();

DO $$
DECLARE
    curated_mentions integer;
    curated_scores integer;
    curated_alerts integer;
    placeholder_mentions integer;
BEGIN
    SELECT count(*) INTO curated_mentions
    FROM mentions m JOIN tenants t ON t.id = m.tenant_id JOIN counties c ON c.id = m.county_id
    WHERE t.slug = 'geolabs' AND c.code = 20
      AND m.external_id LIKE 'kirinyaga-curated-2026%';

    SELECT count(*) INTO curated_scores
    FROM sentiment_scores s JOIN mentions m ON m.id = s.mention_id
    JOIN tenants t ON t.id = m.tenant_id JOIN counties c ON c.id = m.county_id
    WHERE t.slug = 'geolabs' AND c.code = 20
      AND m.external_id LIKE 'kirinyaga-curated-2026%';

    SELECT count(*) INTO curated_alerts
    FROM alerts a JOIN tenants t ON t.id = a.tenant_id JOIN counties c ON c.id = a.county_id
    WHERE t.slug = 'geolabs' AND c.code = 20
      AND a.id IN (
          md5('kirinyaga-curated-alert:illicit-alcohol')::uuid,
          md5('kirinyaga-curated-alert:sagana-makutano-road-safety')::uuid,
          md5('kirinyaga-curated-alert:child-protection')::uuid,
          md5('kirinyaga-curated-alert:fire-response')::uuid
      );

    SELECT count(*) INTO placeholder_mentions
    FROM mentions m JOIN tenants t ON t.id = m.tenant_id JOIN counties c ON c.id = m.county_id
    WHERE t.slug = 'geolabs' AND c.code = 20 AND m.external_id = 'seed-8';

    IF curated_mentions <> 19 OR curated_scores <> 19 OR curated_alerts <> 4 OR placeholder_mentions <> 0 THEN
        RAISE EXCEPTION
          'Kirinyaga refresh validation failed: mentions %, scores %, alerts %, placeholders %',
          curated_mentions, curated_scores, curated_alerts, placeholder_mentions;
    END IF;
END
$$;

COMMIT;
