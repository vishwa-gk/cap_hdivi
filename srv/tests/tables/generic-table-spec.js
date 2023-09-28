/*eslint no-console: 0, no-unused-vars: 0, no-shadow: 0, new-cap: 0, dot-notation:0, no-use-before-define:0 */
/*eslint-env node, es6 */
"use strict";
// use test spec file name as description to allow navigation from the test results view
describe(__filename, () => {

	this.base = __dirname + "/";
	this.test = require("../../utils/tests");
	this.results = [{
		"TABLE_NAME": "Products"
    }, {
		"TABLE_NAME": "ProductCategoryTexts"
    }, {
		"TABLE_NAME": "ProductTexts"
    }, {
		"TABLE_NAME": "SourceData::SalesOrderItems"
    }, {
		"TABLE_NAME": "SourceData::SalesOrders"
	}];
 
	this.results.forEach(async(test) => {
		it(`Table Test: ${test.TABLE_NAME}`, async(done) => {
			try {
				let db = await this.test.getDBClass(await this.test.getClient());
				let sql = `SELECT * FROM "${test.TABLE_NAME}"`;
				console.log("Inside SELECT * Test for table "+ test.TABLE_NAME);
				let statement = await db.preparePromisified(sql);
				let results = await db.statementExecPromisified(statement, []);
				expect(results.length).not.toBeLessThan(1, `Table Name: ${test.TABLE_NAME}`);
				done();
			} catch (err) {
				done.fail(err);
			}
		});
	});

});