const router = require('express').Router();
const sql = require('mssql')
const config = require('../../dbconfig')

router.post('/read_barcode', async (req, res) => {

    process.stdout.write("\nISTEK POST : /read_barcode -> \n");
    console.log(req.body);
    process.stdout.write("\n");

    const location1_barcode = req.body.location1_barcode;
    const product_barcode = req.body.product_barcode;

    try {
        await sql.connect(config);

        var location_id = await sql.query("SELECT Location_ID FROM Locations WHERE Location_Address=N'" + location1_barcode + "'");
        location_id = location_id.recordset[0].Location_ID;

        var query0 = await sql.query("SELECT Quantity FROM Product_Place WHERE Location_ID=" + location_id + " AND Barcode=N'" + product_barcode + "';");
        if (query0.recordset.length == 0) {
            return res.status(400).send({ message: false })
        } else {
            if (query0.recordset[0].Quantity <= 0) {
                return res.status(400).send({ message: false })
            }
        }
        return res.send({ message: true });
    } catch (err) {
        return res.status(400).send({ message: false });
    }
});

router.post('/shift', async (req, res) => {

    process.stdout.write("\nISTEK POST : /shift -> \n");
    console.log(req.body);
    process.stdout.write("\n");

    const username = req.body.username;
    var location1_barcode = req.body.location1_barcode;
    const product_barcode = req.body.product_barcode;
    var location2_barcode = req.body.location2_barcode;

    try {
        await sql.connect(config);

        var location_id1 = await sql.query("SELECT Location_ID FROM Locations WHERE Location_Address=N'" + location1_barcode + "' AND Location_Status='Active';");
        if (location_id1.recordset.length == 0) {
            return res.send({ status: "4", message: "1.Lokasyon blocked", Store1: "", Store2: "", barcode: "" })
        }
        location_id1 = location_id1.recordset[0].Location_ID;

        var location_id2 = await sql.query("SELECT Location_ID FROM Locations WHERE Location_Address=N'" + location2_barcode + "' AND Location_Status='Active';");
        if (location_id2.recordset.length == 0) {
            return res.send({ status: "5", message: "2.Lokasyon blocked", Store1: "", Store2: "", barcode: "" })
        }
        location_id2 = location_id2.recordset[0].Location_ID;

        for (var i = 0; i < product_barcode.length; i++) {
            try {

                var query1 = await sql.query("UPDATE Product_Place SET Quantity=Quantity-1 WHERE Location_ID=" + location_id1 + " AND Barcode=N'" + product_barcode[i] + "';");
                if (query1.rowsAffected[0] <= 0) {
                    await sql.query("INSERT INTO Stock_Netting (Location_ID, Barcode, User_Name, Quantity) VALUES (" + location_id1 + ",N'" + product_barcode[i] + "',N'" + username + "',1);")
                }
			    await sql.query("DELETE FROM Product_Place WHERE Quantity<=0;")

                var query2 = await sql.query("UPDATE Product_Place SET Quantity=Quantity+1 WHERE Location_ID=" + location_id2 + " AND Barcode=N'" + product_barcode[i] + "';");
                if (query2.rowsAffected[0] <= 0) {
                    await sql.query("INSERT INTO Product_Place (Location_ID,Barcode,Quantity) VALUES (" + location_id2 + ",N'" + product_barcode[i] + "',1);");
                }

                var version = await sql.query("SELECT Version FROM Version_User_Match WHERE User_Name=N'" + username + "'");
                version = version.recordset[0].Version;
                await sql.query("INSERT INTO Logbook (Log_Message_ID,User_Name,Time,Version,ID_3,ID_4,Barcode,ID_1,ID_2,ID_5,Additional_Explanation) VALUES (116,N'" + username + "',CURRENT_TIMESTAMP,'" + version + "'," + location_id1 + "," + location_id2 + ",N'" + product_barcode[i] + "','','',0,'');");
            } catch {
                continue;
            }
        }

        var Store1 = await sql.query("SELECT Location_Address FROM Locations WHERE Location_ID=" + location_id1 + ";");
        Store1 = Store1.recordset[0].Location_Address;
        var Store2 = await sql.query("SELECT Location_Address FROM Locations WHERE Location_ID=" + location_id2 + ";");
        Store2 = Store2.recordset[0].Location_Address;
        return res.send({ status: "3", message: "Success", Store1: Store1, Store2: Store2, barcode: "SUCCESS" });
    } catch (err) {
        console.log(err);
        return res.send({ status: "0", message: "Ürün yok!", Store1: "", "": Store2, barcode: "" });
    }
});



module.exports = router;