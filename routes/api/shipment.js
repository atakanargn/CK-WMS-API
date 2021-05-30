const router = require('express').Router();
const sql = require('mssql')
const config = require('../../dbconfig')

router.post('/read_bag', async (req, res) => {

    process.stdout.write("\nISTEK : /read_bag -> \n");
    console.log(req.body);
    process.stdout.write("\n");

    const username = req.body.username;
    const storename = req.body.Store_Name;
    const barcode = req.body.Bag_Id;

    try {
        await sql.connect(config);

        var query8 = await sql.query("SELECT * FROM stores WHERE Store_Name=N'" + storename + "'");
        if (query8.recordset.length == 0) {
            return res.status(404).send({ message: "Böyle bir mağaza yok." });
        }

        var query1 = await sql.query("SELECT * FROM Shipment_Bag WHERE Store_Name=N'" + storename + "' AND Shipment_Bag_Status='Open'");
        if (query1.recordset.length == 0) {
            var query0 = await sql.query("SELECT * FROM Shipment_Bag WHERE Shipment_Bag_ID=N'" + barcode + "' AND Shipment_Bag_Status='Closed';");
            if (query0.recordset.length > 0) {
                return res.status(401).send({ message: "Bu çantanın durumu kapalı." });
            }

            query1 = await sql.query("INSERT INTO Shipment_Bag (Shipment_Bag_ID, Store_Name, Shipment_Bag_Status) VALUES (N'" + barcode + "',N'" + storename + "','Open');")
            var version = await sql.query("SELECT Version FROM Version_User_Match WHERE User_Name=N'" + username + "'");
            version = version.recordset[0].Version;
            await sql.query("INSERT INTO Logbook (Log_Message_ID,User_Name,Time,Version,ID_1) VALUES (107,N'" + username + "',CURRENT_TIMESTAMP,'" + version + "',N '" + barcode + "');")
            return res.send({ status: true, message: "", Barcode: barcode });
        } else {
            return res.send({ status: false, message: "Bu mağaza için çanta açılmış.", Bag_ID: query1.recordset[0].Shipment_Bag_ID });
        }
    } catch (err) {
        return res.status(400).send({ message: "Bir hata oluştu."})
    }
});

router.post('/read_product', async (req, res) => {

    process.stdout.write("\nISTEK : /read_product -> \n");
    console.log(req.body);
    process.stdout.write("\n");

    try {
        await sql.connect(config);
        const username = req.body.username;
        const shipment_bag_id = req.body.Bag_ID;
        const barcode = req.body.barcode;

        var shipment = await sql.query("SELECT Store_Name FROM Shipment_Bag WHERE Shipment_Bag_ID=N'" + shipment_bag_id + "';");

        var rows = await sql.query("SELECT Active_Allocation_List_ID FROM Active_Allocation_List WHERE Barcode=N'" + barcode + "' AND Allocated_Quantity>Actual_Quantity AND Store_Name=N'" + shipment.recordset[0].Store_Name + "';")

        if (rows.recordset.length == 0) {
            return res.send({ dummy: "1", message: "Ürünü Dummy kutusuna atın." })
        } else {
                await sql.query("UPDATE Active_Allocation_List SET Actual_Quantity=Actual_Quantity+1 WHERE Active_Allocation_List_ID=" + rows.recordset[0].Active_Allocation_List_ID + ";")
                var query1 = await sql.query("UPDATE Active_Shipment_Bag_List SET Quantity=Quantity+1 WHERE Shipment_Bag_ID=N'" + shipment_bag_id + "' AND Barcode=N'"+barcode+"'");
                if (query1.rowsAffected[0] == 0) {
                    await sql.query("INSERT INTO Active_Shipment_Bag_List (Shipment_Bag_ID,Barcode,Quantity) VALUES (N'" + shipment_bag_id + "',N'" + barcode + "',1);")
                }

                var version = await sql.query("SELECT Version FROM Version_User_Match WHERE User_Name=N'" + username + "'");
                version = version.recordset[0].Version;
                await sql.query("INSERT INTO Logbook (Log_Message_ID,User_Name,Time,Version,ID_1,Barcode) VALUES (108,N'" + username + "',CURRENT_TIMESTAMP,'" + version + "',N'" + shipment_bag_id + "',N'" + barcode + "');")
            return res.send({ dummy: "2", message: "Ürünü çantanıza atabilirsiniz." })
        }
    } catch (err) {
        return res.send({ dummy: "0", message: "Hata." })
    }
});

router.post('/close_bag', async (req, res) => {

    process.stdout.write("\nISTEK : /close_bag -> \n");
    console.log(req.body);
    process.stdout.write("\n");

    try {
        await sql.connect(config);
        const username = req.body.username;
        const shipment_bag_id = req.body.Bag_ID;
        const location_barcode = req.body.Location_ID;

        var location_id = await sql.query("SELECT Location_ID FROM Locations WHERE Location_Address='" + location_barcode + "';");
        location_id = location_id.recordset[0].Location_ID;
		var fromPlace = await sql.query("SELECT Locations.Location_ID FROM Shipment_Bag LEFT JOIN Locations ON Locations.Location_Address = Shipment_Bag.Store_Name WHERE Shipment_Bag_ID=N'"+shipment_bag_id + "'");
		fromPlace = fromPlace.recordset[0].Location_ID;
        var location_query = await sql.query("SELECT Location_ID,Location_Type FROM Locations WHERE Location_ID=" + location_id + " AND Location_Status='Active';");
        if (location_query.recordset.length == 0) {
            return res.send({ closed: false, message: "Lokasyon aktif değil." })
        } else {
            if (location_query.recordset[0].Location_Type == 'Shipment' || location_query.recordset[0].Location_Type == 'Common') {
                var query1 = await sql.query("UPDATE Shipment_Bag SET Location_ID=" + location_id + ", Shipment_Bag_Status='Closed' WHERE Shipment_Bag_ID=N'" + shipment_bag_id + "'");


                if (query1.rowsAffected[0] > 0) {
                    var activeList = await sql.query("SELECT * FROM Active_Shipment_Bag_List WHERE Shipment_Bag_ID=N'" + shipment_bag_id + "';");
                    for (var i = 0; i < activeList.recordset.length; i++) {
                        var barcode = activeList.recordset[i].Barcode;
                        var quantity = activeList.recordset[i].Quantity;
                        await sql.query("UPDATE Product_Place SET Quantity=Quantity-" + quantity + " WHERE Barcode=N'" + barcode + "' AND Location_ID=" + fromPlace + ";");
                        await sql.query("DELETE FROM Product_Place WHERE Quantity=0 OR Quantity<0;");
						var query2 = await sql.query("UPDATE Product_Place SET Quantity=Quantity+" + quantity + " WHERE Barcode=N'" + barcode + "' AND Location_ID=" + location_id + ";");
						if(query2.rowsAffected[0] == 0){
							await sql.query("INSERT INTO Product_Place (Location_ID, Barcode, Quantity) VALUES (" + location_id + ",N'" + barcode + "'," + quantity + ");");
						}
					}

                    var version = await sql.query("SELECT Version FROM Version_User_Match WHERE User_Name=N'" + username + "'");
                    version = version.recordset[0].Version;
                    await sql.query("INSERT INTO Logbook (Log_Message_ID,User_Name,Time,Version,ID_1,ID_3) VALUES (109,N'" + username + "',CURRENT_TIMESTAMP,'" + version + "',N'" + shipment_bag_id + "', "+location_id+");")

                    return res.send({ closed: true, message: "Success" });
                } else {
                    return res.send({ closed: false, message: "Çanta kapatılmış ya da yok!" });
                }
            } else {
                return res.send({ closed: false, message: "Lokasyon tipi uyumsuz." });
            }
        }


    } catch (err) {
        return res.status(400).send({ message: err.toString() })
    }
});

module.exports = router;