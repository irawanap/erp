async function seedLeaveTypes(client) {
  await client.query(`INSERT INTO "TB_LEAVE_TYPES" (code,name,requires_balance) VALUES ('ANNUAL','Annual Leave',TRUE) ON CONFLICT(code) DO NOTHING`);
}
module.exports = seedLeaveTypes;
