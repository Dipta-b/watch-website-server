const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

app.use(cors());
app.use(express.json());
require('dotenv').config();



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.qvi03.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");

        //Database Collection Name

        const watchCollection = client.db('watchWebsite').collection('watches');
        const cartCollection = client.db('watchWebsite').collection('cart');
        // POST request to add a watch
        app.post('/watches', async (req, res) => {
            const watch = req.body;
            const result = await watchCollection.insertOne(watch);
            res.send(result);
        })
        // GET request to see all watches
        app.get('/watches', async (req, res) => {
            // const email = req.query.email;
            // let queryOnEmail = {};
            // if (email) {
            //     queryOnEmail = { email: email };
            // }

            const limit = parseInt(req.query.limit);
            const cursor = watchCollection.find();
            if (limit) {
                const result = await cursor.limit(limit).toArray();
                res.send(result);
            }
            else {
                const result = await cursor.toArray();
                res.send(result);
            }
        })

        // post request for add to cart
        app.post('/watches/cart', async (req, res) => {
            const watch = req.body;
            const result = await cartCollection.insertOne(watch);
            res.send(result);
            console.log(result)
        })

        //get watches by email
        app.get('/watches/cart', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const cursor = cartCollection.find(query);
            res.send(await cursor.toArray());
        })

        //get request to see a single watch by id
        app.get('/watches/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const watch = await watchCollection.findOne(query);
            res.send(watch);
        })

        // delete a watch by id
        app.delete('/watches/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            res.send(await watchCollection.deleteOne(query));
        })

        // put request to update a watch by id
        app.put('/watches/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedWatch = req.body;
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    name: updatedWatch.name,
                    price: updatedWatch.price,
                    image: updatedWatch.image,
                    description: updatedWatch.description,
                    availablity: updatedWatch.avilability,
                    type: updatedWatch.type,
                    watchName: updatedWatch.watchName,
                    shortDetails: updatedWatch.shortDetails,
                    customerName: updatedWatch.customerName,
                    fullDescription: updatedWatch.fullDescription
                }
            }
            const result = await watchCollection.updateOne(filter, updatedDoc, options);
            res.send(result)
        })


    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);




app.get('/', (req, res) => {
    res.send('Server is for watch website Dipta');
})

app.listen(port, () => {
    console.log(`lsitening on port ${port}`)
})