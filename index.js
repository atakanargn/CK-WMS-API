const express = require('express');
const cors = require('cors');

const app = express();


// Middlewares
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Authentication Route
const authRoute = require('./routes/api/auth');
app.use('/api/auth/', authRoute);

// Acceptance1 Route
const acceptance1Router = require('./routes/api/acceptance1');
app.use('/api/acceptance/1/', acceptance1Router);

// Acceptance2 Route
const acceptance2Router = require('./routes/api/acceptance2');
app.use('/api/acceptance/2/', acceptance2Router);

// Dummy Route
const dummyRouter = require('./routes/api/dummy');
app.use('/api/dummy/', dummyRouter);

// Shipment Route
const shipmentRouter = require('./routes/api/shipment');
app.use('/api/shipment/', shipmentRouter);

// Picking Route
const pickingRouter = require('./routes/api/picking');
app.use('/api/picking/', pickingRouter);

// Carriage Route
const carriageRouter = require('./routes/api/carriage');
app.use('/api/carriage/', carriageRouter);

// Shifting Route
const shiftingRouter = require('./routes/api/shifting');
app.use('/api/shifting/', shiftingRouter);

// Counting Route
const countingRouter = require('./routes/api/counting');
app.use('/api/counting/', countingRouter);

// ZIF Bag
const zifRouter = require('./routes/api/zif_bag');
app.use('/api/zif/', zifRouter);

app.get('/kontrol', async (_, res) => {
    return res.send("Success");
});

// Fako
const fakoRouter = require('./routes/fako');
app.use('/', fakoRouter);

// Serve
app.listen(8282, () => console.log("\nAPI CALISIYOR.\n" + Date()));