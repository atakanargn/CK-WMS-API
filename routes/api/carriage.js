const router = require('express').Router();
const sql = require('mssql');
const config = require('../../dbconfig');

router.post('/match_control', async (req, res) => {

    process.stdout.write("\nISTEK POST: /match_control -> \n");
    console.log(req.body);
    process.stdout.write("\n");

    const username = req.body.username;

    try {
        await sql.connect(config);
        var query1 = await sql.query("SELECT Carriage_Order_ID FROM Carriage_Order_User_Match WHERE User_Name='" + username + "';");
        if (query1.recordset.length > 0) {
            var query2 = await sql.query("SELECT Truck_Plate FROM Carriage_Order WHERE Carriage_Order_ID=" + query1.recordset[0].Carriage_Order_ID);
            return res.send({ status: false, message: "Kullanıcı zaten emir almış.", Carriage_Order_ID: query1.recordset[0].Carriage_Order_ID.toString(), Truck_Plate: query2.recordset[0].Truck_Plate.toString() })
        } else {
            return res.send({ status: true, message: "Emir alabilir", Carriage_Order_ID: "", Truck_Plate: "" })
        }
    } catch (err) {
        return res.status(400).send({ error: err.toString() });
    }
});

router.get('/list_suitable', async (req, res) => {

    process.stdout.write("\nISTEK GET: /logout -> \n");
    process.stdout.write("\n");

    try {
        await sql.connect(config);
        var orders = await sql.query("SELECT Carriage_Order_ID FROM Carriage_Order WHERE Carriage_Order_Status='Open' OR Carriage_Order_Status='In Progress';");
        if (orders.recordset.length > 0) {
            var result = [];
            for (var i = 0; i < orders.recordset.length; i++) {
                result.push({ Carriage_Order_ID: orders.recordset[i].Carriage_Order_ID.toString() });
            }
            return res.send(result);
        } else {
            return res.send([]);
        }
    } catch (err) {
        return res.status(400).send({ error: err.toString() });
    }
});

router.post('/select_order', async (req, res) => {

    process.stdout.write("\nISTEK POST: /select_order -> \n");
    console.log(req.body);
    process.stdout.write("\n");

    const username = req.body.username;
    const Carriage_Order_ID = req.body.Carriage_Order_ID;

    try {
        await sql.connect(config);
        var query1 = await sql.query("SELECT Carriage_Order_Status,Carriage_Order_ID,Truck_Plate FROM Carriage_Order WHERE Carriage_Order_ID=" + Carriage_Order_ID + ";");
        if (query1.recordset.length > 0) {
            if (query1.recordset[0].Carriage_Order_Status == 'Open') {
                var query2 = await sql.query("UPDATE Carriage_Order SET Carriage_Order_Status='In Progress',Order_Start_Time=CURRENT_TIMESTAMP WHERE Carriage_Order_ID=" + query1.recordset[0].Carriage_Order_ID + ";");
            }
            
            await sql.query("INSERT INTO Carriage_Order_User_Match (Carriage_Order_ID, User_Name) VALUES (" + Carriage_Order_ID + ",N'" + username + "');")
			
            var version = await sql.query("SELECT Version FROM Version_User_Match WHERE User_Name=N'" + username + "'");
            version = version.recordset[0].Version;
            await sql.query("INSERT INTO Logbook (Log_Message_ID,User_Name,Time,Version,ID_3,Barcode,ID_1,ID_2,ID_4,ID_5,Additional_Explanation) VALUES (113,N'" + username + "',CURRENT_TIMESTAMP,'" + version + "'," + query1.recordset[0].Carriage_Order_ID + ",'','','',0,0,'');");
            return res.send({ status: true, Carriage_Order_ID: Carriage_Order_ID, Truck_Plate: query1.recordset[0].Truck_Plate })
        } else {
            return res.send({ status: false, message: "Böyle bir emir yok!" })
        }
    } catch (err) {
        return res.status(400).send({ error: err.toString() });
    }
});

router.post('/active_order_list', async (req, res) => {

    process.stdout.write("\nISTEK POST: /active_order_list -> \n");
    console.log(req.body);
    process.stdout.write("\n");

    const username = req.body.username;
    const Carriage_Order_ID = req.body.Carriage_Order_ID;

    try {
        await sql.connect(config);
        var query1 = await sql.query("SELECT Shipment_Bag_ID, Location_ID FROM Active_Carriage_Order_List WHERE Carriage_Order_ID=" + Carriage_Order_ID + " AND isActive=1;");
        if (query1.recordset.length > 0) {
            var result = [];
            for (var i = 0; i < query1.recordset.length; i++) {
                var query2 = await sql.query("SELECT Location_Address FROM Locations WHERE Location_ID=" + query1.recordset[i].Location_ID);
                result.push({ Shipment_Bag_ID: query1.recordset[i].Shipment_Bag_ID.toString(), Location_ID: query2.recordset[0].Location_Address })
            }
            return res.send(result);
        } else {
            return res.send([]);
        }

    } catch (err) {
        return res.status(400).send({ error: err.toString() });
    }
});

router.post('/active_location_control', async (req, res) => {

    process.stdout.write("\nISTEK POST: /active_location_control -> \n");
    console.log(req.body);
    process.stdout.write("\n");

    const username = req.body.username;
    const Carriage_Order_ID = req.body.Carriage_Order_ID;
    const Location_ID = req.body.Location_ID;

    try {
        await sql.connect(config);

        var location_id = await sql.query("SELECT Location_ID FROM Locations WHERE Location_Address='" + Location_ID + "';");
        location_id = location_id.recordset[0].Location_ID;

        var query1 = await sql.query("SELECT * FROM Active_Carriage_Order_List WHERE Carriage_Order_ID=" + Carriage_Order_ID + " AND isActive=1 AND Location_ID=" + location_id);
        if (query1.recordset.length > 0) {
            return res.send({ location: true, message: "" });
        } else {
            return res.send({ location: false, message: "Location barkodu hatalı." });
        }
    } catch (err) {
        return res.status(400).send({ error: err.toString() });
    }
});

router.post('/active_bag_control', async (req, res) => {

    process.stdout.write("\nISTEK POST: /active_bag_control -> \n");
    console.log(req.body);
    process.stdout.write("\n");

    const username = req.body.username;
    const Carriage_Order_ID = req.body.Carriage_Order_ID;
    const Location_ID = req.body.Location_ID;
    const Bag_ID = req.body.Bag_ID;

    try {
        await sql.connect(config);

        var location_id = await sql.query("SELECT Location_ID FROM Locations WHERE Location_Address='" + Location_ID + "';");
        location_id = location_id.recordset[0].Location_ID;

        var query1 = await sql.query("SELECT * FROM Active_Carriage_Order_List WHERE \
        Carriage_Order_ID="+ Carriage_Order_ID + " AND \
        isActive=1 AND \
        Location_ID="+ Location_ID + " AND \
        Shipment_Bag_ID='"+ Bag_ID + "';");
        if (query1.recordset.length > 0) {
            var query2 = await sql.query("UPDATE Active_Carriage_Order_List SET isActive=0, User_Name=N'" + username + "', Carriage_Time=CURRENT_TIMESTAMP WHERE \
            Carriage_Order_ID="+ Carriage_Order_ID + " AND \
            isActive=1 AND \
            Location_ID="+ Location_ID + " AND \
            Shipment_Bag_ID='"+ Bag_ID + "';");
            var Active_Carriage_Order_List_ID = await sql.query("SELECT Active_Carriage_Order_List_ID FROM Active_Carriage_Order_List WHERE \
            Carriage_Order_ID="+ Carriage_Order_ID + " AND \
            isActive=0 AND \
            Location_ID="+ Location_ID + " AND \
            Shipment_Bag_ID='"+ Bag_ID + "';");
            Active_Carriage_Order_List_ID = Active_Carriage_Order_List_ID.recordset[0].Active_Carriage_Order_List_ID;
            if (query2.rowsAffected[0] == 0) {
                return res.send({ bag: false, message: "Hata." });
            }

            var version = await sql.query("SELECT Version FROM Version_User_Match WHERE User_Name=N'" + username + "'");
            version = version.recordset[0].Version;
            await sql.query("INSERT INTO Logbook (Log_Message_ID,User_Name,Time,Version,ID_1,ID_3,ID_4,Barcode,ID_2,ID_5,Additional_Explanation) VALUES (114,N'" + username + "',CURRENT_TIMESTAMP,'" + version + "','" + Bag_ID + "'," + Carriage_Order_ID + "," + Active_Carriage_Order_List_ID + ",'','',0,'');")
            return res.send({ bag: true, message: "Çanta yüklendi." });
        } else {
            return res.send({ bag: false, message: "Çanta barkodu hatalı." });
        }
    } catch (err) {
        return res.status(400).send({ error: err.toString() });
    }
});

router.post('/order_dismiss', async (req, res) => {

    process.stdout.write("\nISTEK POST: /order_dismiss -> \n");
    console.log(req.body);
    process.stdout.write("\n");

    const username = req.body.username;
    const Carriage_Order_ID = req.body.Carriage_Order_ID;

    try {
        await sql.connect(config);
        await sql.query("DELETE FROM Carriage_Order_User_Match WHERE User_Name=N'" + username + "';");

        var query1 = await sql.query("SELECT * FROM Active_Carriage_Order_List WHERE Carriage_Order_ID=" + Carriage_Order_ID + " AND isActive=1;");
        if (query1.recordset.length == 0) {
            await sql.query("UPDATE Carriage_Order SET Carriage_Order_Status='Waiting for Closure' WHERE Carriage_Order_ID=" + Carriage_Order_ID + ";");
        }

        var version = await sql.query("SELECT Version FROM Version_User_Match WHERE User_Name=N'" + username + "'");
        version = version.recordset[0].Version;
        await sql.query("INSERT INTO Logbook (Log_Message_ID,User_Name,Time,Version,ID_3, Barcode, ID_1,ID_2,ID_4,ID_5,Additional_Explanation) VALUES (115,N'" + username + "',CURRENT_TIMESTAMP,'" + version + "'," + Carriage_Order_ID + ",'','','',0,0,'');");
        return res.send({ dismiss: true });
    } catch (err) {
        return res.status(400).send({ dismiss: false });
    }
});

router.post('/order_finish', async (req, res) => {

    process.stdout.write("\nISTEK POST: /order_finish -> \n");
    console.log(req.body);
    process.stdout.write("\n");

    const username = req.body.username;
    const Carriage_Order_ID = req.body.Carriage_Order_ID;

    try {
        await sql.connect(config);
		
        await sql.query("DELETE FROM Carriage_Order_User_Match WHERE User_Name='" + username + "';");
		
		var query1 = await sql.query("SELECT * FROM Carriage_Order_User_Match WHERE Carriage_Order_ID="+Carriage_Order_ID);
        if (query1.recordset.length == 0) {
            await sql.query("UPDATE Carriage_Order SET Carriage_Order_Status='Waiting for Closure' WHERE Carriage_Order_ID=" + Carriage_Order_ID + ";");
        }        

        var version = await sql.query("SELECT Version FROM Version_User_Match WHERE User_Name='" + username + "'");
        version = version.recordset[0].Version;
        await sql.query("INSERT INTO Logbook (Log_Message_ID,User_Name,Time,Version,ID_3,Barcode, ID_1,ID_2,ID_4,ID_5,Additional_Explanation) VALUES (115,'" + username + "',CURRENT_TIMESTAMP,'" + version + "'," + Carriage_Order_ID + ",'','','',0,0,'');");
        return res.send({ finish: true });
    } catch (err) {
        return res.status(400).send({ finish: false });
    }
});

module.exports = router;