const router = require('express').Router();
const sql = require('mssql')
const config = require('../../dbconfig')

router.get('/status_control', async(req, res) => {

    process.stdout.write("\nISTEK GET: /status_control -> \n");
    process.stdout.write("\n");

    try {
        await sql.connect(config);
        var in_progress_count = await sql.query("SELECT COUNT(*) AS SAYI FROM Invoice WHERE Invoice_Status='In Progress';")
        in_progress_count = in_progress_count.recordset[0].SAYI;

        if (in_progress_count == 0) {
            return res.status(200).send({ status: true });
        } else {
            return res.status(200).send({ status: false, message: "İşlemde fatura var."});
        }
    } catch (err) {
        return res.status(400).send({ message: err.toString() })
    }
});

router.post('/read_barcode', async(req, res) => {

    process.stdout.write("\nISTEK POST: /read_barcode -> \n");
    console.log(req.body);
    process.stdout.write("\n");

    const username = req.body.username;
    const barcode = req.body.barcode;

    try {
        await sql.connect(config);

        var query1 = await sql.query("SELECT COUNT(*) AS SAYAC FROM Invoice WHERE Invoice_Status='In Progress';");
        var query1 = query1.recordset[0].SAYAC;
        if (query1 > 0) {
            return res.status(400).send({ message: "İşlemde fatura var." });
        }


        var query2 = await sql.query("SELECT TOP 1 Allocation_ID,Store_Name FROM Active_Allocation_List WHERE Barcode=N'" + barcode + "' AND Allocated_Quantity>Actual_Quantity;");
        if (query2.recordset.length > 0) {
            var query3 = await sql.query("SELECT Allocation_Status AS STATUS FROM Allocation WHERE Allocation_ID=" + query2.recordset[0].Allocation_ID);

            if (query3.recordset[0].STATUS == 'Locked') {
                return res.send({ Store_Name: query2.recordset[0].Store_Name })
            } else {
                return res.send({ Store_Name: "", message: "Ürün Locked değil" })
            }
        }


		var ShelfID = await sql.query("SELECT Location_ID FROM Locations WHERE Location_Address='Shelf';");
		ShelfID = ShelfID.recordset[0].Location_ID;
		await sql.query("INSERT INTO Stock_Netting (Location_ID, Barcode, User_Name,Quantity) VALUES (" + ShelfID + ",N'" + barcode + "',N'" + username + "',1);");

		var query4 = await sql.query("SELECT COUNT(*) AS SAYAC FROM Product_Place WHERE Barcode=N'" + barcode + "' AND Location_ID=" + ShelfID + ";");
		if (query4.recordset[0].SAYAC > 0) {
			await sql.query("UPDATE Product_Place SET Quantity=Quantity+1 WHERE Barcode=N'" + barcode + "' AND Location_ID=" + ShelfID + ";");
		} else {
			await sql.query("INSERT INTO Product_Place (Location_ID,Barcode,Quantity) VALUES (" + ShelfID + ",N'" + barcode + "',1);");
		}
		return res.send({ Store_Name: "Shelf" })
    } catch (err) {
        return res.status(400).send({ message: err.toString() })
    }
});

router.post('/finish', async(req, res) => {

    process.stdout.write("\nISTEK POST: /finish -> \n");
    console.log(req.body);
    process.stdout.write("\n");

    try {
        await sql.connect(config);

        const username = req.body.username;

        var locked = await sql.query("SELECT Allocation_ID FROM Allocation WHERE Allocation_Status='Locked';");

        for (var i = 0; i < locked.recordset.length; i++) {
            var allocatedMoreThanActual = await sql.query("SELECT Barcode,Store_Name,Allocated_Quantity,Actual_Quantity FROM Active_Allocation_List WHERE Allocated_Quantity>Actual_Quantity AND Allocation_ID=" + locked.recordset[i].Allocation_ID);
            for (var k = 0; k < allocatedMoreThanActual.recordset.length; k++) {
                var barcode = allocatedMoreThanActual.recordset[k].Barcode;
                var store_name = allocatedMoreThanActual.recordset[k].Store_Name;
				var difference = allocatedMoreThanActual.recordset[k].Allocated_Quantity-allocatedMoreThanActual.recordset[k].Actual_Quantity;
				var locationID = await sql.query("SELECT Location_ID FROM Locations WHERE Location_Address=N'" + store_name + "';");
				locationID = locationID.recordset[0].Location_ID;

				for(var j=0;j<difference;j++){
					await sql.query("INSERT INTO Stock_Netting (Location_ID, Barcode, User_Name,Quantity) VALUES (" + locationID + ",N'" + barcode + "',N'" + username + "',-1);");
				}
                var query1 = await sql.query("SELECT COUNT(*) AS SAYAC FROM Product_Place WHERE Barcode=N'" + barcode + "' AND Location_ID=" + locationID + ";");
                if (query1.recordset[0].SAYAC > 0){
                    await sql.query("UPDATE Product_Place SET Quantity=Quantity-" + difference + " WHERE Barcode=N'" + barcode + "' AND Location_ID=" + locationID + ";");
					await sql.query("DELETE FROM Product_Place WHERE Quantity<=0");
				}
            }
        }
        return res.send({ message: "Success" });
    } catch (err) {
        return res.status(400).send({ message: err.toString() })
    }
});

module.exports = router;