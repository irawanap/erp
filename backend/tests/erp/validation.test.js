const {
  id
} = require('../../src/shared/validators/common');
const employee = require('../../src/modules/employees/employee.validation');
const types = require('../../src/modules/leave-types/leave-type.validation');
const holidays = require('../../src/modules/holidays/holiday.validation');
const leave = require('../../src/modules/leave-requests/leave-request.validation');
const report = require('../../src/modules/reports/report.validation');
test('partial employee patches do not apply create-only defaults', () => {
  expect(employee.update.parse({
    fullName: 'New Name'
  })).toEqual({
    fullName: 'New Name'
  });
  expect(() => employee.update.parse({})).toThrow();
});
test('partial calendar/type patches preserve status and balance policy', () => {
  expect(types.update.parse({
    name: 'New Name'
  })).toEqual({
    name: 'New Name'
  });
  expect(holidays.update.parse({
    name: 'New Name'
  })).toEqual({
    name: 'New Name'
  });
});
test('UUIDs and real calendar dates are required', () => {
  expect(() => id.parse('1')).toThrow();
  expect(() => holidays.create.parse({
    holidayDate: '2030-02-30',
    name: 'Invalid'
  })).toThrow();
});
test('approval requires a nonempty comment', () => {
  expect(() => leave.decision.parse({
    comment: ' '
  })).toThrow();
});
test('reports require ordered and bounded dates', () => {
  expect(() => report.query.parse({
    startDate: '2031-01-01',
    endDate: '2030-01-01'
  })).toThrow();
  expect(() => report.export.parse({
    startDate: '2020-01-01',
    endDate: '2030-01-01'
  })).toThrow();
});

test('holiday year filters accept calendar years and reject invalid ranges', () => {
  expect(holidays.query.parse({ year: '2026', isActive: 'true' })).toMatchObject({ year: 2026, isActive: true });
  expect(holidays.query.parse({})).not.toHaveProperty('year');
  for (const year of ['1899', '2201', '2026.5', 'invalid']) {
    expect(() => holidays.query.parse({ year })).toThrow();
  }
});
