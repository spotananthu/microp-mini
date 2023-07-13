const express=require("express");
const bodyParser=require("body-parser");
const ejs=require("ejs");
const firebase = require("firebase");
const firebaseConfig = require("./public/js/firebaseConfig");

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const app=express();

function read_sensor() {
  return new Promise((resolve, reject) => {
    const readingsRef = firebase.database().ref('DHT/readings');

    readingsRef.once('value')
      .then((snapshot) => {
        const allReadings = snapshot.val();
        const readingsArray = Object.values(allReadings);
        const lastThreeReadings = readingsArray.slice(-3);

        // Calculate the average of all three values
        const averageReading = calculateAverage(lastThreeReadings);

        const averageObj = {
          humidity: averageReading.humidity,
          moisture: averageReading.moisture,
          temperature: averageReading.temperature
        };

        resolve(averageObj);
      })
      .catch((error) => {
        console.error('Error reading data:', error);
        reject(error);
      });
  });
}

function calculateAverage(readings) {
  if (readings.length === 0) {
    return { humidity: 0, moisture: 0, temperature: 0 }; // Return an object with 0 values if there are no readings
  }

  const sum = readings.reduce((acc, reading) => {
    return {
      humidity: acc.humidity + reading.humidity,
      moisture: acc.moisture + reading.moisture,
      temperature: acc.temperature + reading.temperature
    };
  }, { humidity: 0, moisture: 0, temperature: 0 });

  const average = {
    humidity: sum.humidity / readings.length,
    moisture: sum.moisture / readings.length,
    temperature: sum.temperature / readings.length
  };

  return average;
}

async function readCropData() {
  const ref = db.ref('crops'); // Replace 'path/to/data' with your actual database path

  try {
    const snapshot = await ref.once('value');
    const data = snapshot.val();
    const readingsArray = Object.values(data);
    return readingsArray;
  } catch (error) {
    throw new Error('Error reading data: ' + error);
  }
}

app.use(express.static("public"));
app.set('views',"views");
app.set('view engine','ejs');
app.use(bodyParser.urlencoded({extended:true}));


app.get("/",function(req,res){
    res.sendFile(__dirname+"/home.html");
})

app.get("/login.html",function(req,res){
    res.sendFile(__dirname+"/login.html");
})

app.get("/dashboard",function(req,res){
  res.render("dashboard");
})

app.get("/add_crop.html",function(req,res){
  res.sendFile(__dirname+"/add_crop.html");
})

app.get("/register.html",function(req,res){
    res.sendFile(__dirname+"/register.html");
})

app.get("/marketplace", async function(req, res) {
  try {
    const reading = await readCropData();
    console.log("Inside", reading);
    res.render("marketplace", { title: 'marketplace',crops:reading});
  } catch (error) {
    console.log("Error:", error);
    // Handle the error accordingly
    res.status(500).send("An error occurred");
  }
});

app.listen(3000,function(){
    console.log("Server started on port 3000");
})

app.post("/register",function(req,res)
{
  const name=req.body.name;
  const email=req.body.username;
  const password=req.body.password;
  const address=req.body.address;
  try {
    // Create a new user entry in the database
    const newUserRef = db.ref("users").push();
    // Set the user data
    newUserRef.set({
      name: name,
      email: email,
      password: password,
      address: address
    });
    console.log("User data saved to Firebase");
    res.render("dashboard");
  } catch (err) {
    console.log(err);
  }
  res.render("dashboard");
});

app.post("/dashboard", async function(req, res) {
  const email = req.body.username;
  const password = req.body.password;

  try {
    const usersRef = db.ref("users");
    const snapshot = await usersRef.once("value");
    const users = snapshot.val();
    const foundUser = Object.values(users).find(
      user => user.email === email && user.password === password
    );
    if (foundUser) {
      const readings = await read_sensor();
      console.log(readings);
      // Assuming the readings array contains the data you provided
      //console.log("Outside", readings);
      res.render("dashboard",{readings:readings});
    } else {
      // Username or password is incorrect
      res.status(401).send("Invalid username or password");
    }
  } catch (err) {
    console.log(err);
    res.status(500).send("Internal server error");
  }
});


  app.post("/add_crop.html",function(req,res){
    let title=req.body.crops;
    let quantity=req.body.quantity;
    let amount=req.body.price;
    let address=req.body.address;
    try {
      // Create a new user entry in the database
      const newUserRef = db.ref("crops").push();
      const currentDate = new Date();
      console.log(currentDate);
    // Calculate the future date by adding 24 hours (86400000 milliseconds)
      const futureDate = new Date(currentDate.getTime() + 86400000);
      console.log(futureDate);
      // Set the user data
      newUserRef.set({
        title: title,
        subtitle:"",
        detail:"",
        quantity:quantity,
        amount:amount,
        address:address,
        endTime:futureDate.toISOString()
      });
      console.log("User data saved to Firebase");
      res.sendFile(__dirname+"/add_crop.html");
    } catch (err) {
      console.log(err);
    }
    console.log(title,quantity,amount,address);
  })

