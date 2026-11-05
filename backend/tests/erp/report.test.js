jest.mock('../../src/modules/reports/report.model',()=>({exportRows:jest.fn(),list:jest.fn()}));
jest.mock('../../src/modules/audit/audit.model',()=>({record:jest.fn()}));
const model=require('../../src/modules/reports/report.model');
const service=require('../../src/modules/reports/report.service');
test('CSV escapes quoted/newline values and neutralizes spreadsheet formulas',async()=>{
 model.exportRows.mockResolvedValue([{nik:'=CMD()',full_name:' \t+SUM(1,2)',department_name:'HRD,"Team"\nOffice',leave_type_name:'Annual',used_days:3}]);
 const output=await service.csv({startDate:'2030-01-01',endDate:'2030-01-31'},{publicId:'11111111-1111-4111-8111-111111111111'});
 expect(output.startsWith('\uFEFF')).toBe(true);
 expect(output).toContain('"\'=CMD()"');
 expect(output).toContain('"\' \t+SUM(1,2)"');
 expect(output).toContain('"HRD,""Team""\nOffice"');
});
