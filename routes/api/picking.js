const router = require('express').Router();
const sql = require('mssql');
const config = require('../../dbconfig');

router.post('/list_suitable', async (req, res) => {
    const username = req.body.username;

    process.stdout.write("\nISTEK : /list_suitable -> \n");
    console.log(req.body);
    process.stdout.write("\n");

    try {
        await sql.connect(config);
        var query1 = await sql.query("SELECT Picking_Order_ID FROM Picking_Order_User_Match WHERE User_Name=N'" + username + "';");
        if (query1.recordset.length > 0) {
            var returned = [];
            for (var i = 0; i < query1.recordset.length; i++) {
                returned.push({ "Picking_Order_ID": query1.recordset[i].Picking_Order_ID.toString() });
            }
            return res.send(returned);
        } else {
            return res.send({ status: false, message: "Bu kullanıcı ile eşleşen Picking Order yok!" });
        }

    } catch (err) {
        return res.status(400).send({ message: err.toString() })
    }
});

router.post('/select_order', async (req, res) => {
    const username = req.body.username;
    const Picking_Order_ID = req.body.Picking_Order_ID;

    process.stdout.write("\nISTEK : /select_order -> \n");
    console.log(req.body);
    process.stdout.write("\n");

    try {
        await sql.connect(config);
        var query1 = await sql.query("UPDATE Picking_Order SET Picking_Order_Status='In Progress', Order_Start_Time=CURRENT_TIMESTAMP WHERE Picking_Order_ID=" + Picking_Order_ID + ";")
        if (query1.rowsAffected[0] > 0) {

            var version = await sql.query("SELECT Version FROM Version_User_Match WHERE User_Name=N'" + username + "'");
            version = version.recordset[0].Version;
            await sql.query("INSERT INTO Logbook (Log_Message_ID,User_Name,Time,Version,ID_3,Barcode,ID_1,ID_2,ID_4,ID_5,Additional_Explanation) VALUES (110,'" + username + "',CURRENT_TIMESTAMP,'" + version + "'," + Picking_Order_ID + ",'','','',0,0,'');")
            return res.send({ status: true, Picking_Order_ID: Picking_Order_ID.toString(), message: "" });
        } else {
            return res.send({ status: false, Picking_Order_ID: "", message: "Böyle bir emir yok!" });
        }
    } catch (err) {
        return res.status(400).send({ message: err.toString() })
    }
});

router.post('/select_picking_car', async (req, res) => {
    const username = req.body.username;
    const Picking_Order_ID = req.body.Picking_Order_ID;
    const Picking_Car_ID = req.body.Picking_Car_ID;

    process.stdout.write("\nISTEK : /select_picking_car -> \n");
    console.log(req.body);
    process.stdout.write("\n");

    try {
        await sql.connect(config);
        var query1 = await sql.query("SELECT Location_ID FROM Locations WHERE Location_Address=" + Picking_Car_ID);
        if (query1.recordset.length > 0) {
            return res.send({ status: true, Picking_Car_ID: query1.recordset[0].Location_ID.toString(), Picking_Car: Picking_Car_ID })
        } else {
            return res.send({ status: false, message: "Böyle bir araba yok!" })
        }
    } catch (err) {
        return res.status(400).send({ message: err.toString() });
    }
});

router.post('/order_list', async (req, res) => {
    const username = req.body.username;
    const Picking_Order_ID = req.body.Picking_Order_ID;
    const Picking_Car_ID = req.body.Picking_Car_ID;

    process.stdout.write("\nISTEK : /order_list -> \n");
    console.log(req.body);
    process.stdout.write("\n");

    try {
        await sql.connect(config);
        var query1 = await sql.query("SELECT TOP 1 Location_Address AS Store_Name,Barcode FROM Active_Picking_Order_List LEFT JOIN Locations ON Active_Picking_Order_List.Location_ID=Locations.Location_ID WHERE Picking_Order_ID=" + Picking_Order_ID);
        
		// Location_Status blocked ise Alternatif emir oluşturulacak
		
		if (query1.recordset.length > 0) {
            var result = query1.recordset[0];
            result.status = true;
            result.message = "";
            return res.send(result);
        } else {
            return res.send({ status: false, message: "Hiç aktif emir yok.", Store_Name: "", Barcode: "" })
        }
    } catch (err) {
        return res.status(400).send({ message: err.toString() });
    }
});

router.post('/read_location_barcode', async (req, res) => {
    const username = req.body.username;
    const Picking_Order_ID = req.body.Picking_Order_ID;
    const Picking_Car_ID = req.body.Picking_Car_ID;
    const Store_Name = req.body.Store_Name;
    const location_barcode = req.body.Location_Barcode;

    process.stdout.write("\nISTEK : /read_location_barcode -> \n");
    console.log(req.body);
    process.stdout.write("\n");

    try {
        await sql.connect(config);

        var location_id = await sql.query("SELECT Location_ID FROM Locations WHERE Location_Address='" + location_barcode + "';");
        location_id = location_id.recordset[0].Location_ID;	
		
        var query1 = await sql.query("SELECT * FROM Active_Picking_Order_List WHERE Picking_Order_ID="+Picking_Order_ID+" AND Status='In Progress' AND Location_ID=" + location_id);
        if (query1.recordset.length > 0 && query1.recordset[0].Location_Address == Store_Name) {
            return res.send({ status: true, Location_Barcode: location_barcode, message: "Kutudan ürünleri alabilirsiniz." })
        } else {
            return res.send({ status: false, message: "Lokasyon doğru değil veya Bloklu." })
        }
    } catch (err) {
        return res.status(400).send({ message: err.toString() });
    }
});

router.post('/read_barcode', async (req, res) => {
    const username = req.body.username;
    const Picking_Order_ID = req.body.Picking_Order_ID;
    const Picking_Car_ID = req.body.Picking_Car_ID;
    const Store_Name = req.body.Store_Name;
    const location_barcode = req.body.Location_Barcode;
    const barcode = req.body.barcode;

    process.stdout.write("\nISTEK : /read_barcode -> \n");
    console.log(req.body);
    process.stdout.write("\n");

    try {
        await sql.connect(config);

        var location_id = await sql.query("SELECT Location_ID FROM Locations WHERE Location_Address='" + location_barcode + "';");
        location_id = location_id.recordset[0].Location_ID;

        var active_picking_id = await sql.query("SELECT TOP 1 Active_Picking_Order_List_ID FROM Active_Picking_Order_List WHERE \
        Picking_Order_ID="+ Picking_Order_ID + " AND \
        Barcode='"+ barcode + "' AND \
        Location_ID="+ location_id + " AND \
        Status='In Progress' \
        ORDER BY Active_Picking_Order_List_ID ASC;");
        active_picking_id = active_picking_id.recordset[0].Active_Picking_Order_List_ID;

        var query1 = await sql.query("UPDATE Active_Picking_Order_List SET Status='Picked Up' WHERE Active_Picking_Order_List_ID=" + active_picking_id + ";");

        if (query1.rowsAffected[0] > 0) {
            var query2 = await sql.query("UPDATE Product_Place SET Quantity=Quantity-1 WHERE Location_ID=" + location_id + " AND Barcode='" + barcode + "';");
            if (query2.rowsAffected[0] > 0) {
                var query3 = await sql.query("UPDATE Product_Place SET Quantity=Quantity+1 WHERE Location_ID=" + Picking_Car_ID + " AND Barcode='" + barcode + "';");
                if (query3.rowsAffected[0] == 0) {
                    await sql.query("INSERT INTO Product_Place (Location_ID,Barcode,Quantity) VALUES (" + Picking_Car_ID + ",'" + barcode + "',1);");
                }

                var version = await sql.query("SELECT Version FROM Version_User_Match WHERE User_Name='" + username + "'");
                version = version.recordset[0].Version;
                await sql.query("INSERT INTO Logbook (Log_Message_ID,User_Name,Time,Version,ID_3,ID_4) VALUES (111,'" + username + "',CURRENT_TIMESTAMP,'" + version + "'," + Picking_Order_ID + "," + active_picking_id + ");");
            }
            return res.send({ read: true, message: "Success" })
        } else {
            return res.send({ read: false, message: "Ürün hatalı." })
        }
    } catch (err) {
        return res.send({ read: false, message: "Ürün hatalı." })
    }
});

router.post('/cannot_find', async (req, res) => {

    process.stdout.write("\nISTEK : /cannot_find -> \n");
    console.log(req.body);
    process.stdout.write("\n");

    const username = req.body.username;
    const Picking_Order_ID = req.body.Picking_Order_ID;
    const Picking_Car_ID = req.body.Picking_Car_ID;
    const Store_Name = req.body.Store_Name;
    const location_barcode = req.body.Location_Barcode;
    const barcode = req.body.barcode;

    try {
        await sql.connect(config);

        var active_pickings = await sql.query("SELECT Active_Picking_Order_List_ID,Barcode FROM Active_Picking_Order_List WHERE \
        Picking_Order_ID="+ Picking_Order_ID + " AND \
        Barcode='"+ barcode + "' AND \
        Location_ID="+ location_barcode + " AND \
        Status='In Progress' \
        ORDER BY Active_Picking_Order_List_ID ASC;");

        var basarili = false;
        for (var i = 0; i < active_pickings.recordset.length; i++) {
            var active_picking_id = active_pickings.recordset[i].Active_Picking_Order_List_ID;

            var location_id = await sql.query("SELECT Location_ID FROM Locations WHERE Location_Address='" + location_barcode + "';");
            location_id = location_id.recordset[0].Location_ID;

            var query1 = await sql.query("UPDATE Product_Place SET Quantity=Quantity-1 WHERE Location_ID=" + location_id + " AND Barcode='" + barcode + "';");
            if (query1.rowsAffected[0] > 0) {
                await sql.query("INSERT INTO Stock_Netting (Location_ID,Barcode,User_Name,Quantity) VALUES (" + location_id + ",'" + barcode + "','" + username + "',-1);");
                var query3 = await sql.query("UPDATE Active_Picking_Order_List SET Status='Cannot Find' WHERE Active_Picking_Order_List_ID=" + active_picking_id + ";");
                if (query3.rowsAffected[0] > 0) {
                    var query4 = await sql.query("INSERT INTO Active_Picking_Order_List\
                    (Picking_Order_ID,Barcode,Location_ID,Store_Name,Status) VALUES\
                    ("+ Picking_Order_ID + ",'" + barcode + "'," + location_id + ", '" + Store_Name + "','In Progress');");

                    var version = await sql.query("SELECT Version FROM Version_User_Match WHERE User_Name='" + username + "'");
                    version = version.recordset[0].Version;
                    await sql.query("INSERT INTO Logbook (Log_Message_ID,User_Name,Time,Version,ID_3,ID_4) VALUES (112,'" + username + "',CURRENT_TIMESTAMP,'" + version + "'," + Picking_Order_ID + "," + active_picking_id + ");");
                    basarili = true;
                }
            }
        }

        if (basarili) {
            return res.send({ status: true })
        } else {
            return res.send({ status: false })
        }
    } catch (err) {
        console.log(err);
        return res.send({ status: false })
    }
});

router.post('/read_allocation', async (req, res) => {

    process.stdout.write("\nISTEK : /read_allocation -> \n");
    console.log(req.body);
    process.stdout.write("\n");

    const username = req.body.username;
    const Picking_Order_ID = req.body.Picking_Order_ID;
    const Picking_Car_ID = req.body.Picking_Car_ID;
    const Store_Name = req.body.Store_Name;
    const location_barcode = req.body.Location_Barcode;
    const barcode = req.body.barcode;

    try {
        if (barcode == null || barcode == "") {
            return res.send({ read: false, Store_Name: "", message: "Barkod okutmanız gerek!" })
        }

        var location_id = await sql.query("SELECT Location_ID FROM Locations WHERE Location_Address='" + location_barcode + "';");
        location_id = location_id.recordset[0].Location_ID;

        await sql.connect(config);
        var StoreName = await sql.query("SELECT Store_Name FROM Active_Allocation_List WHERE Barcode='" + barcode + "';");
        if (StoreName.recordset.length == 0) {
            return res.send({ read: false, Store_Name: "", message: "Ürün bulunamadı." })
        }
        StoreName = StoreName.recordset[0].Store_Name;
        var query1 = await sql.query("SELECT Quantity FROM Product_Place WHERE Quantity>0 AND Location_ID=" + Picking_Car_ID + " AND Barcode='" + barcode + "';");
        if (query1.recordset.length == 0) {
            return res.send({ read: false, Store_Name: "", message: "Bu ürün arabaya yüklenmemiş!" })
        }
        var query2 = await sql.query("UPDATE Product_Place SET Quantity=Quantity-1 WHERE Location_ID=" + Picking_Car_ID + " AND Barcode='" + barcode + "';;\
        UPDATE Active_Allocation_List SET Allocated_Quantity=Allocated_Quantity+1 WHERE Barcode='" + barcode + "';")
        return res.send({ read: true, Store_Name: StoreName, message: "" })
    } catch (err) {
        return res.send({ read: false, Store_Name: "", message: err.toString() })
    }
});

module.exports = router;