const bcrypt = require('bcryptjs')

const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

app.use(cookieParser());
app.use(cors({
    origin: ['http://localhost:5174'],
    credentials: true
}));
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
        const usersCollection = client.db('watchWebsite').collection('users');
        //jwt route
        app.post('/jwt', async (req, res) => {
            const email = req.body.email;
            if (!email) return res.status(400).send({ message: 'Email required' });

            const user = { email };
            const token = jwt.sign(user, process.env.JWT_SECRET_TOKEN, { expiresIn: '1h' });
            res.send({ token });
        });

        //JWT Middleware
        const verifyJWT = (req, res, next) => {
            const authHeader = req.headers.authorization;
            if (!authHeader) return res.status(401).send({ message: 'Unauthorized' });

            const token = authHeader.split(' ')[1];
            jwt.verify(token, process.env.JWT_SECRET_TOKEN, (err, decoded) => {
                if (err) return res.status(403).send({ message: 'Forbidden' });
                req.user = decoded; // decoded = { email }
                next();
            });
        };

        //admin middleware
        const verifyAdmin = async (req, res, next) => {
            const email = req.user.email;
            const adminUser = await usersCollection.findOne({ email });
            if (!adminUser || adminUser.role !== 'admin') {
                return res.status(403).send({ message: 'Admin access only' });
            }
            next();
        };


        //make first admin as me
        async function createFirstAdmin() {
            try {


                // Check if admin already exists
                const existingAdmin = await usersCollection.findOne({ email: "diptabanik0@gmail.com" });
                if (existingAdmin) {
                    console.log("Admin already exists!");
                    return;
                }

                app.post('/users', async (req, res) => {
                    const { email, name, role, approved } = req.body;
                    if (!email) return res.status(400).send({ message: 'Email required' });

                    const existingUser = await usersCollection.findOne({ email });
                    if (existingUser) return res.send(existingUser);

                    const newUser = { email, name, role: role || 'user', approved: approved || false };
                    const result = await usersCollection.insertOne(newUser);
                    res.send(result);
                });



                // Hash the password
                const plainPassword = "12345Dipta"; // replace with your password
                const hashedPassword = await bcrypt.hash(plainPassword, 10);

                // Insert first admin
                const result = await usersCollection.insertOne({
                    name: "Dipta Banik",
                    email: "diptabanik0@gmail.com",
                    password: hashedPassword,
                    role: "admin"
                });

                console.log("First admin created with ID:", result.insertedId);
                console.log(`You can now log in with email: diptabanik0@gmail.com and password: ${plainPassword}`);
            } catch (err) {
                console.error("Error creating admin:", err);
            } finally {
                // await client.close();
                console.log("MongoDB connection closed.");
            }
        }

        createFirstAdmin();
        //
        app.patch('/users/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const result = await usersCollection.updateOne(
                { email: email },
                { $set: { role: "admin" } }
            )
            res.send(result);
        })

        //getting the role of logged in user admin ? or not.
        app.get('/users/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const user = await usersCollection.findOne({ email: email });
            if (!user) return res.status(404).send({ admin: false });
            res.send({ admin: user.role === 'admin' });
        })


        // POST request to add a watch
        app.post('/watches', verifyJWT, verifyAdmin, async (req, res) => {
            try {
                const watch = req.body;
                const productWithStatus = {
                    ...watch,
                    approved: 'pending',
                    createdAt: new Date(),
                    createdBy: req.user.email
                };
                const result = await watchCollection.insertOne(productWithStatus);
                res.send(result);
            } catch (error) {
                console.error(error);
                res.status(500).send({ message: 'Server Error', error: error.message });
            }
        });


        //get pending product only andmin
        app.get('/watches/pending', verifyJWT, verifyAdmin, async (req, res) => {
            const pendingProducts = await watchCollection.find({ approved: 'pending' }).toArray();
            res.send(pendingProducts);
        })

        //to change status
        app.put('/watches/approve/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const { action } = req.body; // "approved" or "rejected"

            if (!['approved', 'rejected'].includes(action)) {
                return res.status(400).send({ message: 'Invalid action' });
            }

            const result = await watchCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: { approved: action } }
            );

            res.send(result);
        });


        // Get all registered users who are pending approval
        app.get('/users/pending', verifyJWT, verifyAdmin, async (req, res) => {
            const pendingUsers = await usersCollection.find({ approved: false }).toArray();
            res.send(pendingUsers);
        });

        // Approve user and make them admin
        app.patch('/users/approve/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const result = await usersCollection.updateOne(
                { email },
                { $set: { role: "admin", approved: true } }
            );
            res.send(result);
        });

        // Reject user (delete from DB)
        app.delete('/users/reject/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const result = await usersCollection.deleteOne({ email });
            res.send(result);
        });




        // GET request to see all watches
        app.get('/watches', async (req, res) => {
            try {
                const limit = parseInt(req.query.limit);
                const filter = { approved: 'approved' }; // ✅ only approved products
                const cursor = watchCollection.find(filter);

                let result;
                if (limit) {
                    result = await cursor.limit(limit).toArray();
                } else {
                    result = await cursor.toArray();
                }

                res.send(result);
            } catch (error) {
                console.error("Error fetching watches:", error);
                res.status(500).send({ message: "Server error", error: error.message });
            }
        });


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
        app.delete('/watches/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            res.send(await watchCollection.deleteOne(query));
        })

        // put request to update a watch by id
        app.put('/watches/:id', verifyJWT, async (req, res) => {
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