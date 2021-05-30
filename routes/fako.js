const router = require('express').Router();
const sql = require('mssql')
const config = require('../dbconfig')

router.get('/fako', async (req, res) => {

	process.stdout.write("\nISTEK POST: /fako -> \n");
	console.log(req.body);
	process.stdout.write("\n");

	try {
		await sql.connect(config);
		return res.send([
            {name:"CO2", value:(Math.floor(Math.random() * 101)).toString(), type:"ppm"},
            {name:"H20", value:(Math.floor(Math.random() * 10)).toString(), type:""},
            {name:"Sıcaklık", value:(Math.floor(Math.random() * 10)+20).toString(), type:"C"},
            {name:"Öneri",value:"Test önerisidir.",type:""}
        ]);
	} catch (err) {
		return res.status(400).send({ message: err.toString() });
	}
});

module.exports = router;