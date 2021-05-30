const router = require('express').Router();
const sql = require('mssql')
const config = require('../../dbconfig')

router.post('/read_bag', async(req, res) => {
    process.stdout.write("\nISTEK POST: ZIF_BAG : /read_bag -> \n");
    console.log(req.body);
    process.stdout.write("\n");

    const username = req.body.username;
    const zif_bag = req.body.Bag_ID;
	const location_address = req.body.Location_ID;

    try {
        await sql.connect(config);
	
	
        try {
			var location_id = await sql.query("SELECT Location_ID FROM Locations WHERE Location_Address=N'"+location_address+"'");
			location_id = location_id.recordset[0].Location_ID;
		
            var query1 = await sql.query("DECLARE @STORE VARCHAR(255);\
			SELECT @STORE=Store_Name FROM ZIF_Bag WHERE ZIF_Bag_ID=N'" + zif_bag + "' AND isActive=1;\
			INSERT INTO Shipment_Bag (Shipment_Bag_ID,Store_Name,Shipment_Bag_Status,Location_ID) VALUES (N'" + zif_bag + "',@STORE,'Closed'," + location_id + ");\
			");
        } catch (err) {
            return res.status(404).send({ message: "Böyle bir ZIF_Bag yok!" })
        }

        if (query1.rowsAffected[0] > 0) {
            var query2 = await sql.query("INSERT INTO Active_Shipment_Bag_List (Shipment_Bag_ID,Barcode,Quantity)\
                                            SELECT ZIF_Bag_ID,Barcode,Quantity\
                                            FROM Active_ZIF_Bag_List\
                                            WHERE ZIF_Bag_ID='" + zif_bag + "';\
                                            INSERT INTO Inactive_ZIF_Bag_List (ZIF_Bag_ID,Barcode,Quantity)\
                                            SELECT ZIF_Bag_ID,Barcode,Quantity\
                                            FROM Active_ZIF_Bag_List\
                                            WHERE ZIF_Bag_ID=N'" + zif_bag + "';\
                                            UPDATE ZIF_Bag SET isActive=0 WHERE ZIF_Bag_ID=N'" + zif_bag + "' AND isActive=1;\
                                            DELETE FROM Active_ZIF_Bag_List\
                                            WHERE ZIF_Bag_ID=N'" + zif_bag + "';");
            
                var version = await sql.query("SELECT Version FROM Version_User_Match WHERE User_Name=N'" + username + "';");
                version = version.recordset[0].Version;
                await sql.query("INSERT INTO Logbook (Log_Message_ID,User_Name,Time,Version,ID_1,Barcode,ID_2,ID_3,ID_4,ID_5,Additional_Explanation) VALUES (117,N'" + username + "',CURRENT_TIMESTAMP,'" + version + "','" + zif_bag + "','','',0,0,0,'');")
                return res.send({ message: "Çanta sevkiyat çantaları arasına eklendi." });
        } else {
            return res.status(404).send({ message: "Böyle bir ZIF_Bag yok!" })
        }
    } catch (err) {
        return res.status(400).send({ message: err.toString() })
    }
});

module.exports = router;