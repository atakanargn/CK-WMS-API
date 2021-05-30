const router = require('express').Router();
const sql = require('mssql')
const config = require('../../dbconfig')

router.get('/list_counting', async(req,res)=>{
    const username = req.body.username;

    process.stdout.write("\nISTEK GET: /list_counting -> \n");
    process.stdout.write("\n");
    try {
        await sql.connect(config);
        var result = [];
        var query1 = await sql.query("SELECT DISTINCT Counting_ID FROM Counting_Assignments WHERE User_Name=N'"+username+"';");
        if(query1.recordset.length>0){

            for(var i=0;i<query1.recordset.length;i++){
                var query2 = await sql.query("SELECT Counting_ID FROM Counting WHERE (Counting_Status='Open' OR Counting_Status='In Progress') AND Counting_ID="+query1.recordset[i].Counting_ID+";");
                if(query2.recordset.length>0){
                    result.push({Counting_ID:query2.recordset[0].Counting_ID.toString()});
                }
            }
        }
        return res.send(result);
    }catch (err) {
        return res.send(result)
    }
});

router.post('/list_locations', async(req,res)=>{
    const username = req.body.username;
    const Counting_ID = req.body.Counting_ID;

    process.stdout.write("\nISTEK POST: /list_locations -> \n");
    console.log(req.body);
    process.stdout.write("\n");

    try {
        await sql.connect(config);
        var query1 = await sql.query("SELECT Location_Address FROM Counting_Assignments LEFT JOIN Locations ON Counting_Assignments.Location_ID=Locations.Location_ID WHERE Counting_ID="+Counting_ID+" AND User_Name=N'"+username+"';");
        var result = [];
        for(var i=0;i<query1.recordset.length;i++){
            result.push({Store_Name:query1.recordset[0].Location_Address});
        }
        return res.send(result);
    }catch (err) {
        return res.send({status:false,Counting_ID:"",mesage:err.toString()});
    }
});

router.post('/read_location', async(req,res)=>{
    const username = req.body.username;
    const Counting_ID = req.body.Counting_ID;
    const Location_Address = req.body.Location_ID;

    process.stdout.write("\nISTEK POST: /read_location -> \n");
    console.log(req.body);
    process.stdout.write("\n");

    try {
        await sql.connect(config);
        var query1 = await sql.query("SELECT * FROM Counting_Assignments LEFT JOIN Locations ON Counting_Assignments.Location_ID=Locations.Location_ID WHERE Counting_ID="+Counting_ID+" AND User_Name=N'"+username+"' AND Location_Address=N'"+Location_Address+"';")
        return res.send({status:(query1.recordset.length>0), Assignment_ID:query1.recordset[0].Assignment_ID});
    }catch (err) {
        return res.send({status:false,Counting_ID:"",mesage:err.toString()});
    }
});

router.post('/read_barcode', async(req,res)=>{
    const username = req.body.username;
    const Counting_ID = req.body.Counting_ID;
	const Assignment_ID = req.body.Assignment_ID;
    const barcode = req.body.barcode;

    process.stdout.write("\nISTEK POST: /read_barcode -> \n");
    console.log(req.body);
    process.stdout.write("\n");

    try {
        await sql.connect(config);

            var query2 = await sql.query("UPDATE Active_Counting_Results SET Quantity=Quantity+1 WHERE Assignment_ID="+Assignment_ID+" AND Barcode=N'"+barcode+"';");
            if(query2.rowsAffected[0]>0){
                return res.send({read:true,message:"Success"})
            }else{
                var query3 = await sql.query("INSERT INTO Active_Counting_Results (Assignment_ID,Barcode,Quantity) VALUES ("+Assignment_ID+",N'"+barcode+"',1);");
                if(query3.rowsAffected[0]>0){
                    return res.send({read:true,message:"Success"})
                }else{
                    return res.send({read:false,mesage:"Bir hata oluştu."})
                }
            }
    }catch (err) {
        return res.send({read:false,mesage:err.toString()});
    }
});

router.post('/finish', async(req,res)=>{
    const username = req.body.username;
    const Counting_ID = req.body.Counting_ID;
	const Assignment_ID = req.body.Assignment_ID;

    process.stdout.write("\nISTEK POST: /finish -> \n");
    console.log(req.body);
    process.stdout.write("\n");

    try {
        await sql.connect(config);
        var query1 = await sql.query("UPDATE Counting_Assignments SET isActive=0 WHERE Assignment_ID="+Assignment_ID);
        
		var query2 = await sql.query("SELECT * FROM Counting_Assignments WHERE isActive=1 AND Counting_ID="+Counting_ID);
		if(query2.recordset.length==0){
			await sql.query("UPDATE Counting SET Counting_Status='Waiting for Closure' WHERE Counting_ID="+Counting_ID);
		}
		return res.send({status:query1.rowsAffected[0]>0})
    }catch (err) {
        return res.send({status:false,mesage:err.toString()});
    }
})

module.exports = router;