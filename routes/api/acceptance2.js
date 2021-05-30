const router = require('express').Router();
const sql = require('mssql')
const config = require('../../dbconfig')

router.post('/get_allocation', async(req, res) => {

    process.stdout.write("\nISTEK POST: /get_allocation -> \n");
    console.log(req.body);
    process.stdout.write("\n");

    try {
        const acceptance_id = req.body.acceptance_id;
        await sql.connect(config);

        var purchase_order_id = await sql.query("SELECT Purchase_Order_ID FROM Acceptance WHERE Acceptance_ID=" + acceptance_id);
        purchase_order_id = purchase_order_id.recordset[0].Purchase_Order_ID;

        var query1 = await sql.query("SELECT Allocation_ID FROM Allocation WHERE Purchase_Order_ID=N'" + purchase_order_id + "';");
        var allocation_id = query1.recordset[0].Allocation_ID;

        return res.send({ allocation_id: allocation_id.toString() });
    } catch (err) {
        return res.status(400).send({ message: err.toString() });
    }
});

router.post('/get_crossdock', async(req, res) => {

    process.stdout.write("\nISTEK POST: /get_crossdock -> \n");
    console.log(req.body);
    process.stdout.write("\n");

    const acceptance_id = req.body.acceptance_id;

    try {
        await sql.connect(config);

        var purchase_order_id = await sql.query("SELECT Purchase_Order_ID FROM Acceptance WHERE Acceptance_ID=" + acceptance_id);
        purchase_order_id = purchase_order_id.recordset[0].Purchase_Order_ID;

        var query1 = await sql.query("SELECT Allocation_ID FROM Allocation WHERE Purchase_Order_ID=N'" + purchase_order_id + "';");
        var allocation_id = query1.recordset[0].Allocation_ID;

        var query1 = await sql.query("SELECT Cross_Dock_ID, Barcode FROM Active_Cross_Dock_List WHERE isActive=0 AND Allocation_ID=" + allocation_id + " ORDER BY Cross_Dock_ID DESC");
        var result = []
        for (var i = 0; i < query1.recordset.length; i++) {
            result.push({ Barcode: query1.recordset[i].Barcode, Cross_Dock_ID: query1.recordset[i].Cross_Dock_ID.toString() })
        }
        res.send(result);
    } catch (err) {
        console.log(err);
        return res.status(400).send({ message: err.toString() })
    }
});

router.post('/read_barcode', async(req, res) => {

    process.stdout.write("\nISTEK POST: /read_barcode -> \n");
    console.log(req.body);
    process.stdout.write("\n");

    const acceptance_id = req.body.acceptance_id;
    const allocation_id = req.body.allocation_id;
    var barcode = req.body.barcode;
    const username = req.body.username;
    var crossDock_ID = "";

    try {
        await sql.connect(config);
        var storeName = "";

        var query1 = await sql.query("SELECT Store_Name,Cross_Dock_ID FROM Active_Cross_Dock_List WHERE Allocation_ID=" + allocation_id + " AND isActive=1 AND Barcode=N'" + barcode + "' ORDER BY Cross_Dock_ID ASC");
        if (query1.recordset.length > 0) {
            storeName = query1.recordset[0].Store_Name;
            crossDock_ID = query1.recordset[0].Cross_Dock_ID;

            await sql.query("UPDATE Active_Cross_Dock_List SET isActive=0 WHERE Cross_Dock_ID=" + crossDock_ID);
            await sql.query("UPDATE Active_Allocation_List SET Allocated_Quantity=Allocated_Quantity+1 WHERE Allocation_ID=" + allocation_id + " AND Barcode=N'" + barcode + "' AND Store_Name=N'" + storeName + "'");
        } else {
            var query2 = await sql.query("SELECT * FROM Product_Master_Data WHERE Barcode=N'" + barcode + "'");

            if (query2.recordset.length > 0) {
                var query3 = await sql.query("SELECT * FROM Allocation WHERE Allocation_ID=" + allocation_id + " AND User_Name='System-Return'");
                if (query3.recordset.length > 0) {
                    storeName = "Return";
                } else {
                    storeName = "Shelf";
                }
            } else {
                storeName = "Jane Doe";
                barcode = "Jane Doe";
            }

            await sql.query("INSERT INTO Active_Cross_Dock_List (Allocation_ID, Barcode, Store_Name,isActive) VALUES (" + allocation_id + ",N'" + barcode + "',N'" + storeName + "',0)");
            crossDock_ID = await sql.query("SELECT * FROM Active_Cross_Dock_List WHERE Allocation_ID=" + allocation_id + " AND Barcode=N'" + barcode + "' AND Store_Name =N'" + storeName + "'");
            crossDock_ID = crossDock_ID.recordset[0].Cross_Dock_ID;
            var query4 = await sql.query("SELECT * FROM Active_Allocation_List WHERE Allocation_ID=" + allocation_id + " AND Barcode = N'" + barcode + "' AND Store_Name=N'" + storeName + "'");
            if (query4.recordset.length > 0) {
                await sql.query("UPDATE Active_Allocation_List SET Allocated_Quantity=Allocated_Quantity+1, Actual_Quantity=Actual_Quantity+1 WHERE Allocation_ID=" + allocation_id + " AND Barcode=N'" + barcode + "' AND Store_Name=N'" + storeName + "'");
            } else {
                await sql.query("INSERT INTO Active_Allocation_List (Allocation_ID,Barcode,Store_Name,Allocated_Quantity,Planned_Quantity,Actual_Quantity, Priority) VALUES (" + allocation_id + ",N'" + barcode + "',N'" + storeName + "',1,0,1,1)");
            }

        }

        var query5 = await sql.query("UPDATE Active_Acceptance_Control SET Accepted_Quantity=Accepted_Quantity+1 WHERE Acceptance_ID=" + acceptance_id + " AND Barcode=N'" + barcode + "';");
        if (query5.rowsAffected[0] == 0) {
            await sql.query("INSERT INTO Active_Acceptance_Control (Acceptance_ID,Barcode,Invoice_Quantity,Accepted_Quantity) VALUES (" + acceptance_id + ",N'" + barcode + "',0,1);");
        }

        var location_id = await sql.query("SELECT Location_ID FROM Locations WHERE Location_Address=N'" + storeName + "'");
        location_id = location_id.recordset[0].Location_ID;

        var query6 = await sql.query("UPDATE Product_Place SET Quantity=Quantity+1 WHERE Location_ID=" + location_id + " AND Barcode=N'" + barcode + "';");
        if (query6.rowsAffected[0] == 0) {
            await sql.query("INSERT INTO Product_Place (Location_ID,Barcode,Quantity) VALUES (" + location_id + ",N'" + barcode + "',1)");
        }

        if (storeName == "Jane Doe") {
            var purchase_order_id = await sql.query("SELECT Purchase_Order_ID FROM Acceptance WHERE Acceptance_ID=" + acceptance_id);
            purchase_order_id = purchase_order_id.recordset[0].Purchase_Order_ID;

            var invoice_id = await sql.query(" SELECT Invoice_ID FROM Acceptance WHERE Acceptance_ID=" + acceptance_id + ";");
            invoice_id = invoice_id.recordset[0].Invoice_ID;

            var query7 = await sql.query("UPDATE Active_Jane_Doe SET Quantity=Quantity+1 WHERE Purchase_Order_ID='" + purchase_order_id + "' AND Invoice_ID=" + invoice_id);
            if (query7.rowsAffected[0] == 0) {
                await sql.query("INSERT INTO Active_Jane_Doe (Jane_Doe_ID,Purchase_Order_ID,Invoice_ID,Quantity) VALUES ('Jane Doe',N'" + purchase_order_id + "'," + invoice_id + ",1);");
            }
        }

        var version = await sql.query("SELECT Version FROM Version_User_Match WHERE User_Name=N'" + username + "'");
        version = version.recordset[0].Version;
        await sql.query("INSERT INTO Logbook (Log_Message_ID, User_Name, Time, Version, ID_3, ID_4, Barcode,ID_1,ID_2,ID_5,Additional_Explanation) VALUES (102, N'" + username + "', CURRENT_TIMESTAMP, '" + version + "', " + acceptance_id + " ," + crossDock_ID + ", N'" + storeName + "','','',0,'')")

        return res.send({ message: "", Store_Name: storeName, Cross_Dock_ID: crossDock_ID.toString() })
    } catch (err) {
        console.log(err);
        return res.status(400).send({ message: err.toString() })
    }
});

router.post('/remove_barcode', async(req, res) => {

    process.stdout.write("\nISTEK POST: /remove_barcode -> \n");
    console.log(req.body);
    process.stdout.write("\n");

    const acceptance_id = req.body.acceptance_id;
    const allocation_id = req.body.allocation_id;
    var barcode = req.body.barcode;
    const username = req.body.username;
    var crossDock_ID = req.body.Cross_Dock_ID;

    try {
        await sql.connect(config);
        var query1 = await sql.query("SELECT Store_Name,Cross_Dock_ID,Barcode FROM Active_Cross_Dock_List WHERE Cross_Dock_ID=" + crossDock_ID + " AND isActive=0;");
        storeName = query1.recordset[0].Store_Name;
        crossDock_ID = query1.recordset[0].Cross_Dock_ID;
		barcode=query1.recordset[0].Barcode;

        var location_id = await sql.query("SELECT Location_ID FROM Locations WHERE Location_Address=N'" + storeName + "'");
        location_id = location_id.recordset[0].Location_ID;

        await sql.query("UPDATE Active_Cross_Dock_List SET isActive=1 WHERE Cross_Dock_ID=" + crossDock_ID);
        if (storeName == "Jane Doe" || storeName == "Return" || storeName == "Shelf") {
            await sql.query("UPDATE Active_Allocation_List SET Allocated_Quantity=Allocated_Quantity-1, Actual_Quantity=Actual_Quantity-1 WHERE Allocation_ID=" + allocation_id + " AND Barcode=N'" + barcode + "' AND Store_Name=N'" + storeName + "'");
        } else {
            await sql.query("UPDATE Active_Allocation_List SET Allocated_Quantity=Allocated_Quantity-1 WHERE Allocation_ID=" + allocation_id + " AND Barcode=N'" + barcode + "' AND Store_Name=N'" + storeName + "'");
        }
        await sql.query("DELETE FROM Active_Allocation_List WHERE Planned_Quantity=0 AND Allocated_Quantity=0 AND Actual_Quantity=0");
        await sql.query("UPDATE Active_Acceptance_Control SET Accepted_Quantity=Accepted_Quantity-1 WHERE Acceptance_ID=" + acceptance_id + " AND Barcode=N'" + barcode + "'");
        await sql.query("DELETE FROM Active_Acceptance_Control WHERE Invoice_Quantity=0 AND Accepted_Quantity=0");
        await sql.query("UPDATE Product_Place SET Quantity=Quantity-1 WHERE Location_ID=" + location_id + " AND Barcode=N'" + barcode + "'");
        await sql.query("DELETE FROM Product_Place WHERE Quantity=0");

        if (storeName == "Jane Doe") {
            var purchase_order_id = await sql.query("SELECT Purchase_Order_ID FROM Acceptance WHERE Acceptance_ID=" + acceptance_id);
            purchase_order_id = purchase_order_id.recordset[0].Purchase_Order_ID;

            var invoice_id = await sql.query(" SELECT Invoice_ID FROM Acceptance WHERE Acceptance_ID=" + acceptance_id + ";");
            invoice_id = invoice_id.recordset[0].Invoice_ID;

            await sql.query("UPDATE Active_Jane_Doe SET Quantity=Quantity-1 WHERE Purchase_Order_ID='" + purchase_order_id + "' AND Invoice_ID=" + invoice_id);
            await sql.query("DELETE FROM Active_Jane_Doe WHERE Quantity=0");
        }

        var version = await sql.query("SELECT Version FROM Version_User_Match WHERE User_Name=N'" + username + "'");
        version = version.recordset[0].Version;
        await sql.query("INSERT INTO Logbook (Log_Message_ID, User_Name, Time, Version, ID_3, ID_4, Barcode, ID_1,ID_2,ID_5,Additional_Explanation) VALUES (118, N'" + username + "', CURRENT_TIMESTAMP, '" + version + "', " + acceptance_id + " ," + crossDock_ID + ", N'" + storeName + "', '','',0,'')")

        return res.send({ success: true })
    } catch (err) {
        return res.status(400).send({ message: err.toString() })
    }

});

router.post('/finish', async(req, res) => {

    process.stdout.write("\nISTEK POST: /finish -> \n");
    console.log(req.body);
    process.stdout.write("\n");

    const acceptance_id = req.body.acceptance_id;
    const allocation_id = req.body.allocation_id;
    const username = req.body.username;

    try {
        await sql.connect(config);

        var query0 = await sql.query("SELECT * FROM Acceptance_User_Match WHERE Acceptance_ID=" + acceptance_id + " AND User_Name<>N'" + username + "'");
        if (query0.recordset.length == 0) {
            await sql.query("INSERT INTO Inactive_Cross_Dock_List (Allocation_ID,Barcode,Store_Name)\
			SELECT Allocation_ID,Barcode,Store_Name\
			FROM Active_Cross_Dock_List\
			WHERE isActive=0 AND Allocation_ID=" + allocation_id + ";\
			DELETE FROM Active_Cross_Dock_List\
			WHERE isActive=0 AND Allocation_ID=" + allocation_id + ";\
			DECLARE @INVOICE_ID INT;\
			SELECT @INVOICE_ID=Invoice_ID FROM Acceptance WHERE Acceptance_ID=" + acceptance_id + ";\
			UPDATE Acceptance SET Acceptance_Status='Waiting for Closure' WHERE Acceptance_ID=" + acceptance_id + ";\
			UPDATE Invoice SET Invoice_Status='Waiting for Closure' WHERE Invoice_ID=@INVOICE_ID;\
			DELETE FROM Acceptance_User_Match WHERE User_Name=N'" + username + "';")

            var version = await sql.query("SELECT Version FROM Version_User_Match WHERE User_Name=N'" + username + "'");
            version = version.recordset[0].Version;
            await sql.query("INSERT INTO Logbook (Log_Message_ID,User_Name,Time,Version,ID_3,Barcode,ID_1,ID_2,ID_4,ID_5,Additional_Explanation) VALUES (103,N'" + username + "',CURRENT_TIMESTAMP,'" + version + "'," + acceptance_id + ",'','','',0,0,'');")
        } else {
            await sql.query("DELETE FROM Acceptance_User_Match WHERE User_Name=N'" + username + "'");
        }
        return res.send({ message: "Success" })
    } catch (err) {
        return res.status(400).send({ message: err.toString() })
    }
});


module.exports = router;