const router = require('express').Router();
const sql = require('mssql')
const config = require('../../dbconfig')

router.post('/login', async(req, res) => {

    process.stdout.write("\nISTEK POST: /login -> \n");
    console.log(req.body);
    process.stdout.write("\n");

    const username = req.body.username;
    const password = req.body.password;
    const version = req.body.version;

    try {
        await sql.connect(config)
        var result = await sql.query("SELECT * FROM Users WHERE User_Name=N'" + username + "' AND Password=N'" + password + "' COLLATE SQL_Latin1_General_CP1_CS_AS");
        if (result.recordset.length == 1) {
            if (result.recordset[0].Status == false) {
                await sql.query("UPDATE Users SET Status='true' where User_Name=N'" + username + "'");
                await sql.query("INSERT INTO Version_User_Match (User_Name,Version) VALUES (N'" + username + "','" + version + "');");
                await sql.query("INSERT INTO Logbook (Log_Message_ID,User_Name,Time,Version,Barcode,ID_1,ID_2,ID_3,ID_4,ID_5, Additional_Explanation) VALUES (101,N'" + username + "',CURRENT_TIMESTAMP,'" + version + "','','','',0,0,0,'')")
                result = await sql.query("SELECT * FROM Users WHERE User_Name=N'" + username + "'");

                var roles = await sql.query("SELECT PreAcceptance_Hand,Acceptance_Hand,Shipment_Bag_Hand,Picking_Hand,Carriage_Hand FROM Roles WHERE Role_Name='" + result.recordset[0]['Role_Name'] + "'");

                var lastRoles = [];

                for (var key in roles.recordset[0]) {
                    if (key == 'Acceptance_Hand') {
                        lastRoles.push((roles.recordset[0][key] ? 1 : 0));
                        lastRoles.push((roles.recordset[0][key] ? 1 : 0));
                        continue;
                    }
                    if (roles.recordset[0].hasOwnProperty(key)) {
                        lastRoles.push((roles.recordset[0][key] ? 1 : 0));
                    }
                }

                lastRoles.push(1);
                lastRoles.push(1);

                return res.send({ username: result.recordset[0].User_Name, Role_Name: result.recordset[0].Role_Name, roles: lastRoles });
            } else {
                // Log-Message 100 : Kullanıcı zaten çevrimiçi.
                await sql.query("INSERT INTO Logbook (Log_Message_ID,User_Name,time,version,Barcode,ID_1,ID_2,ID_3,ID_4,ID_5, Additional_Explanation) VALUES (100,N'" + username + "',CURRENT_TIMESTAMP,'" + version + "','','','',0,0,0,'')")
                return res.status(401).send({ message: "Kullanıcı çevrimiçi." });
            }
        } else {
            return res.status(404).send({ message: "Böyle bir kullanıcı yok!" });
        }
    } catch (err) {
        return res.status(405).send({ message: err.toString() })
    }
});

router.post('/logout', async(req, res) => {

    process.stdout.write("\nISTEK POST: /logout -> \n");
    console.log(req.body);
    process.stdout.write("\n");

    const username = req.body.username;

    try {
        await sql.connect(config)
        var result = await sql.query("SELECT * FROM Users WHERE User_Name=N'" + username + "'");

        if (result.recordset.length == 1) {
            if (result.recordset[0].Status == true) {
                await sql.query("UPDATE Users SET Status='false' where User_Name=N'" + username + "'");
                result = await sql.query("SELECT * FROM Users WHERE User_Name=N'" + username + "'");
                await sql.query("DELETE FROM Version_User_Match WHERE User_Name=N'" + username + "';");
                return res.send({ message: "Çıkış başarılı", username: result.recordset[0].User_Name });
            } else {
                return res.status(400).send({ message: "Kullanıcı zaten çevrimiçi değil!" });
            }
        } else {
            return res.status(404).send({ message: "Böyle bir kullanıcı yok!" });
        }
    } catch (err) {
        return res.status(400).send({ message: err.toString() });
    }
});

router.get('/online_users', async(_, res) => {

    process.stdout.write("\nISTEK GET: /online_users -> \n");
    process.stdout.write("\n");

    try {
        await sql.connect(config)
        const users = await sql.query("SELECT User_Name FROM Users WHERE Status=1");
        return res.send({ users: users.recordset });
    } catch (err) {
        return res.status(400).send({ message: err.toString() })
    }
})

router.post('/status_control', async(req, res) => {

    process.stdout.write("\nISTEK : /status_control -> \n");
    console.log(req.body);
    process.stdout.write("\n");

    const username = req.body.username;

    try {
        await sql.connect(config)
        var result = await sql.query("SELECT * FROM Users WHERE User_Name=N'" + username + "'");

        if (result.recordset.length == 1) {
            return res.send({ status: result.recordset[0].Status });
        } else {
            return res.status(404).send({ message: "Böyle bir kullanıcı yok!" });
        }
    } catch (err) {
        return res.status(400).send({ message: err.toString() })
    }
});

module.exports = router;