const model = require('./dashboard.model');
const {
  context
} = require('../../shared/utils/business');
async function summary(req, res) {
  res.json({
    success: true,
    data: await model.summary(context(req))
  });
}
function settings(req, res) {
  res.json({
    success: true,
    data: {
      workWeekdays: require('../leave-requests/calendar').weekdays(),
      timezone: 'Asia/Jakarta',
      employeeStatuses: ['Active', 'Inactive', 'Resigned'],
      leaveStatuses: ['Draft', 'Submitted', 'Approved', 'Rejected', 'Cancelled'],
      cancellationStatuses: ['Draft', 'Submitted'],
      approvalLevels: 1,
      balanceReservedOnSubmit: false
    }
  });
}
module.exports = {
  summary,
  settings
};
