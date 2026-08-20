import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";
import { pool } from "../db";
import {
  ensureTallySchema,
  postInboundVoucher,
  updateInboundVoucherForReview,
} from "../tallyService";

after(async () => {
  await pool.end();
});

test("inbound approval is atomic, idempotent, and rejects non-review records", async () => {
  const suffix = randomUUID();
  const configId = `test-tally-${suffix}`;
  const inboxId = `test-tally-inbox-${suffix}`;
  const rejectedInboxId = `test-tally-rejected-${suffix}`;
  const alterationRaceInboxId = `test-tally-alteration-${suffix}`;
  const externalId = `TEST-TALLY-${suffix}`;
  const rejectedExternalId = `TEST-TALLY-REJECTED-${suffix}`;
  const debitLedger = `Test Tally Debit ${suffix}`;
  const creditLedger = `Test Tally Credit ${suffix}`;

  await ensureTallySchema();

  try {
    const ledgers = await pool.query(
      `SELECT id FROM general_ledgers WHERE is_active=true ORDER BY id LIMIT 2`
    );
    assert.equal(ledgers.rows.length, 2, "test requires two active general ledgers");

    await pool.query(
      `INSERT INTO tally_config
         (id, company_name, financial_year, is_active)
       VALUES ($1,$2,'2026-2027',true)`,
      [configId, `Test Tally Company ${suffix}`]
    );
    await pool.query(
      `INSERT INTO tally_mappings
         (config_id, mapping_type, tally_name, internal_id, internal_type, is_active)
       VALUES
         ($1,'general_ledger',$2,$3,'general_ledger',true),
         ($1,'general_ledger',$4,$5,'general_ledger',true)`,
      [configId, debitLedger, ledgers.rows[0].id, creditLedger, ledgers.rows[1].id]
    );

    const payload = {
      externalId,
      alterationId: "1",
      voucherType: "Journal",
      voucherNumber: `TEST-JV-${suffix}`,
      voucherDate: "2026-08-20",
      narration: "Tally simultaneous approval regression test",
      company: `Test Tally Company ${suffix}`,
      financialYear: "2026-2027",
      lines: [
        { ledgerName: debitLedger, amount: 100, drCr: "DR" },
        { ledgerName: creditLedger, amount: 100, drCr: "CR" },
      ],
    };

    await pool.query(
      `INSERT INTO tally_voucher_inbox
         (id, config_id, external_id, alteration_id, voucher_type, voucher_number,
          voucher_date, company, financial_year, raw_payload, status)
       VALUES
         ($1,$2,$3,'1','Journal',$4,'2026-08-20',$5,'2026-2027',$6::jsonb,'review'),
         ($7,$2,$8,'1','Journal',$9,'2026-08-20',$5,'2026-2027',$10::jsonb,'rejected')`,
      [
        inboxId,
        configId,
        externalId,
        payload.voucherNumber,
        payload.company,
        JSON.stringify(payload),
        rejectedInboxId,
        rejectedExternalId,
        `TEST-REJECTED-${suffix}`,
        JSON.stringify({
          ...payload,
          externalId: rejectedExternalId,
          voucherNumber: `TEST-REJECTED-${suffix}`,
        }),
      ]
    );
    const alterationPayload = {
      ...payload,
      externalId: `TEST-TALLY-ALTERATION-${suffix}`,
      voucherNumber: `TEST-ALTERATION-${suffix}`,
    };
    await pool.query(
      `INSERT INTO tally_voucher_inbox
         (id, config_id, external_id, alteration_id, voucher_type, voucher_number,
          voucher_date, company, financial_year, raw_payload, status)
       VALUES ($1,$2,$3,'1','Journal',$4,'2026-08-20',$5,'2026-2027',$6::jsonb,'review')`,
      [
        alterationRaceInboxId,
        configId,
        alterationPayload.externalId,
        alterationPayload.voucherNumber,
        payload.company,
        JSON.stringify(alterationPayload),
      ]
    );

    const [first, second] = await Promise.all([
      postInboundVoucher(inboxId, "reviewer-a", configId),
      postInboundVoucher(inboxId, "reviewer-b", configId),
    ]);

    assert.equal(first.voucherMasId, second.voucherMasId);
    assert.equal(first.voucherNo, second.voucherNo);

    const posted = await pool.query(
      `SELECT i.status, i.posted_voucher_mas_id,
              COUNT(vm.id)::int AS voucher_count
       FROM tally_voucher_inbox i
       LEFT JOIN voucher_mas vm
         ON vm.source_type='tally_import' AND vm.source_id=i.id
       WHERE i.id=$1
       GROUP BY i.status, i.posted_voucher_mas_id`,
      [inboxId]
    );
    assert.equal(posted.rows[0].status, "posted");
    assert.equal(posted.rows[0].posted_voucher_mas_id, first.voucherMasId);
    assert.equal(posted.rows[0].voucher_count, 1);

    const repeated = await postInboundVoucher(inboxId, "reviewer-c", configId);
    assert.equal(repeated.voucherMasId, first.voucherMasId);

    // Even if future code accidentally reopens a posted row, the permanent
    // posting claim repairs it instead of creating a duplicate voucher.
    await pool.query(
      `UPDATE tally_voucher_inbox
       SET status='review', posted_voucher_mas_id=NULL
       WHERE id=$1`,
      [inboxId]
    );
    const repaired = await postInboundVoucher(inboxId, "reviewer-d", configId);
    assert.equal(repaired.voucherMasId, first.voucherMasId);
    const repairedState = await pool.query(
      `SELECT i.status, i.posted_voucher_mas_id,
              COUNT(vm.id)::int AS voucher_count
       FROM tally_voucher_inbox i
       LEFT JOIN voucher_mas vm
         ON vm.source_type='tally_import' AND vm.source_id=i.id
       WHERE i.id=$1
       GROUP BY i.status, i.posted_voucher_mas_id`,
      [inboxId]
    );
    assert.equal(repairedState.rows[0].status, "posted");
    assert.equal(repairedState.rows[0].posted_voucher_mas_id, first.voucherMasId);
    assert.equal(repairedState.rows[0].voucher_count, 1);

    await assert.rejects(
      postInboundVoucher(rejectedInboxId, "reviewer-a", configId),
      /only review records can be approved/
    );
    const rejected = await pool.query(
      `SELECT status, posted_voucher_mas_id FROM tally_voucher_inbox WHERE id=$1`,
      [rejectedInboxId]
    );
    assert.equal(rejected.rows[0].status, "rejected");
    assert.equal(rejected.rows[0].posted_voucher_mas_id, null);

    // Hold the inbox lock like an approval transaction, start the exact
    // connector alteration update used by the route, then commit the post.
    // PostgreSQL must re-check status!='posted' after the wait and skip update.
    const approvalClient = await pool.connect();
    try {
      await approvalClient.query("BEGIN");
      await approvalClient.query(
        `SELECT id FROM tally_voucher_inbox WHERE id=$1 FOR UPDATE`,
        [alterationRaceInboxId]
      );
      const alterationUpdate = updateInboundVoucherForReview({
        inboxId: alterationRaceInboxId,
        configId,
        voucher: {
          ...alterationPayload,
          alterationId: "2",
          narration: "connector alteration that must not reopen posted",
        },
        conflictReason: "",
      });
      await new Promise(resolve => setTimeout(resolve, 50));

      await approvalClient.query(
        `INSERT INTO tally_posting_claims
           (inbox_id, config_id, external_id)
         VALUES ($1,$2,$3)`,
        [alterationRaceInboxId, configId, alterationPayload.externalId]
      );
      const simulatedPost = await approvalClient.query(
        `INSERT INTO voucher_mas
           (voucher_no, voucher_type, voucher_date, narration,
            total_amount, taxable_amount, tax_amount,
            source_type, source_id, ref_no)
         VALUES ($1,'Journal','2026-08-20','approval race test',
                 '100','100','0','tally_import',$2,$3)
         RETURNING id`,
        [`TEST-RACE-${suffix}`, alterationRaceInboxId, alterationPayload.voucherNumber]
      );
      await approvalClient.query(
        `UPDATE tally_posting_claims
         SET voucher_mas_id=$1, updated_at=now()
         WHERE inbox_id=$2`,
        [simulatedPost.rows[0].id, alterationRaceInboxId]
      );
      await approvalClient.query(
        `UPDATE tally_voucher_inbox
         SET status='posted', posted_voucher_mas_id=$1, updated_at=now()
         WHERE id=$2`,
        [simulatedPost.rows[0].id, alterationRaceInboxId]
      );
      await approvalClient.query("COMMIT");

      assert.equal(await alterationUpdate, "already_posted");
      const alterationState = await pool.query(
        `SELECT i.status, i.alteration_id,
                COUNT(vm.id)::int AS voucher_count
         FROM tally_voucher_inbox i
         LEFT JOIN voucher_mas vm
           ON vm.source_type='tally_import' AND vm.source_id=i.id
         WHERE i.id=$1
         GROUP BY i.status, i.alteration_id`,
        [alterationRaceInboxId]
      );
      assert.equal(alterationState.rows[0].status, "posted");
      assert.equal(alterationState.rows[0].alteration_id, "1");
      assert.equal(alterationState.rows[0].voucher_count, 1);
    } catch (error) {
      await approvalClient.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      approvalClient.release();
    }
  } finally {
    await pool.query(
      `DELETE FROM voucher_det
       WHERE voucher_mas_id IN (
         SELECT id FROM voucher_mas
         WHERE source_type='tally_import' AND source_id IN ($1,$2,$3)
       )`,
      [inboxId, rejectedInboxId, alterationRaceInboxId]
    ).catch(() => {});
    await pool.query(
      `DELETE FROM tally_external_refs WHERE config_id=$1`,
      [configId]
    ).catch(() => {});
    await pool.query(
      `DELETE FROM tally_bank_recon WHERE config_id=$1`,
      [configId]
    ).catch(() => {});
    await pool.query(
      `DELETE FROM tally_audit_log WHERE config_id=$1`,
      [configId]
    ).catch(() => {});
    await pool.query(
      `DELETE FROM voucher_mas
       WHERE source_type='tally_import' AND source_id IN ($1,$2,$3)`,
      [inboxId, rejectedInboxId, alterationRaceInboxId]
    ).catch(() => {});
    await pool.query(
      `DELETE FROM tally_voucher_inbox WHERE config_id=$1`,
      [configId]
    ).catch(() => {});
    await pool.query(
      `DELETE FROM tally_mappings WHERE config_id=$1`,
      [configId]
    ).catch(() => {});
    await pool.query(
      `DELETE FROM tally_config WHERE id=$1`,
      [configId]
    ).catch(() => {});
  }
});