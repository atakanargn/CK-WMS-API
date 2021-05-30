const router = require('express').Router();
const sql = require('mssql')
const config = require('../../dbconfig')

router.post('/match_control', async(req, res) => {

    process.stdout.write("\nISTEK POST: /match_control -> \n");
    console.log(req.body);
    process.stdout.write("\n");

    const username = req.body.username;

    try {
        await sql.connect(config);
        const result = await sql.query("SELECT Acceptance_ID FROM Acceptance_User_Match where User_Name=N'" + username + "'");
        if (result.recordset.length == 0) {
            return res.send({ match: false, acceptance_id: "0" });
        } else {
            const acceptance_id = result.recordset[0]['Acceptance_ID'];

            var Invoice_Number = await sql.query("DECLARE @InvoiceID INT;\
            SELECT @InvoiceID=Invoice_ID FROM Acceptance WHERE Acceptance_ID="+acceptance_id+";\
            SELECT Invoice_Number FROM Invoice WHERE Invoice_ID=@InvoiceID;");
            Invoice_Number = Invoice_Number.recordset[0].Invoice_Number;
            return res.send({ match: true, acceptance_id: acceptance_id.toString(), Invoice_Number:Invoice_Number });
        }
    } catch (err) {
        return res.status(400).send({ message: err.toString() });
    }
})

router.get('/list_suitable', async(_, res) => {

    process.stdout.write("\nISTEK GET: /list_suitable -> \n");
    process.stdout.write("\n");

    try {
        await sql.connect(config);

        var staOpen = await sql.query("SELECT Invoice_ID FROM Acceptance WHERE Acceptance_Status='Open'");
        var staInProgress = await sql.query("SELECT * FROM Acceptance WHERE Acceptance_Status='In Progress'");

        staOpen = staOpen.recordsets[0];
        staInProgress = staInProgress.recordsets[0];

        var result = [];

        for (var i = 0; i < staInProgress.length; i++) {
            var query = "DECLARE @Active" + i + "User AS INT;\
            SELECT @Active" + i + "User = COUNT(Acceptance_ID) FROM Acceptance_User_Match WHERE Acceptance_ID=" + staInProgress[i].Acceptance_ID + ";\
            SELECT Invoice_ID FROM Acceptance WHERE Acceptance_Status='In Progress' AND Multi_User>@Active" + i + "User AND Acceptance_ID=" + staInProgress[i].Acceptance_ID + ";";

            var addResult = await sql.query(query);
            addResult = addResult.recordset[0];
            if (addResult != null) {
                result.push(addResult);
            }
        };

        result = staOpen.concat(result);

        var result2 = [];

        for (var i = 0; i < result.length; i++) {
            var query = await sql.query("SELECT Invoice_Number FROM Invoice WHERE Invoice_ID=" + result[i].Invoice_ID);

            if (query.recordset[0] != null) {
                result2.push(query.recordset[0]);
            }
        }

        var lastResult = [];
        for (var i = 0; i < result2.length; i++) {
            lastResult.push({ "invoice_id": result2[i].Invoice_Number.toString() });
        }

        return res.send(lastResult);
    } catch (err) {
        return res.status(400).send({ message: err.toString() });
    }
});

router.post('/select_invoice', async(req, res) => {

    process.stdout.write("\nISTEK POST: /select_invoice -> \n");
    console.log(req.body);
    process.stdout.write("\n");

    const invoiceNumber = req.body.Invoice_Number;
    const username = req.body.username;

    try {
        await sql.connect(config);

        var query1 = await sql.query("SELECT Invoice_ID, Invoice_Status FROM Invoice WHERE Invoice_Number='" + invoiceNumber + "'");

        var query2 = await sql.query("SELECT Acceptance_ID,Multi_User,Acceptance_Status FROM Acceptance WHERE Invoice_ID=" + query1.recordset[0].Invoice_ID + ";");

        var acceptance_id = query2.recordset[0].Acceptance_ID;
        var multi_user = query2.recordset[0].Multi_User;
		var isActive = query2.recordset[0].Acceptance_Status.toString();
		
        var active_user = await sql.query("SELECT COUNT(*) AS active_user FROM Acceptance_User_Match WHERE Acceptance_ID=" + acceptance_id);
        active_user = active_user.recordset[0].active_user;

        if (isActive == "Open" || (isActive == "In Progress" && active_user < multi_user)) {
            await sql.query("UPDATE Acceptance SET Acceptance_Status='In Progress' WHERE Acceptance_ID=" + acceptance_id + ";\
            INSERT INTO Acceptance_User_Match (Acceptance_ID,User_Name) VALUES (" + acceptance_id + ",N'" + username + "');");

            var version = await sql.query("SELECT Version FROM Version_User_Match WHERE User_Name=N'" + username + "'");
            version = version.recordset[0].Version;
            await sql.query("INSERT INTO Logbook (Log_Message_ID,User_Name,Time,Version,ID_3,Barcode, ID_1,ID_2,ID_4,ID_5,Additional_Explanation) VALUES (102,N'" + username + "',CURRENT_TIMESTAMP,'" + version + "'," + acceptance_id + ",'','','',0,0,'');");
        } else {
            return res.status(400).send({ message: "Işlem başkası tarafından alınmış." });
        }
        return res.send({ message: "", acceptance_id: acceptance_id.toString() });
    } catch (err) {
        return res.status(400).send({ message: err.toString() })
    }
});

module.exports = router;