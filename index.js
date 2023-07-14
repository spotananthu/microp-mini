const express=require("express");
const bodyParser=require("body-parser");
const ejs=require("ejs");
const firebase = require("firebase");
const firebaseConfig = require("./public/js/firebaseConfig");

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const app=express();

async function fetchChartData() {
  try {
    const readingsSnapshot = await firebase.database().ref("DHT/readings").once("value");
    const allReadings = readingsSnapshot.val();

    const currentDate = new Date().toISOString().split('T')[0];
    const pastSevenDays = [];
    const temperatureArray = [];
    const humidityArray = [];
    const moistureArray = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const formattedDate = date.toISOString().split('T')[0];
      pastSevenDays.push(formattedDate);
    }

    for (const day of pastSevenDays) {
      const filteredReadings = Object.values(allReadings).filter(reading => reading.date === day);

      const temperatures = filteredReadings.map(reading => reading.temperature);
      const averageTemperature = calculateAverageWeekly(temperatures);
      temperatureArray.push(averageTemperature);

      const humidities = filteredReadings.map(reading => reading.humidity);
      const averageHumidity = calculateAverageWeekly(humidities);
      humidityArray.push(averageHumidity);

      const moistures = filteredReadings.map(reading => reading.moisture);
      const averageMoisture = calculateAverageWeekly(moistures);
      moistureArray.push(averageMoisture);
    }

    return {
      temperatureArray: temperatureArray.reverse(),
      humidityArray: humidityArray.reverse(),
      moistureArray: moistureArray.reverse()
    };
  } catch (error) {
    throw error;
  }
}


function calculateAverageWeekly(values) {
  const sum = values.reduce((total, value) => total + value, 0);
  return sum / values.length || 0;
}

function read_sensor() {
  return new Promise((resolve, reject) => {
    const readingsRef = firebase.database().ref('DHT/readings');

    readingsRef.once('value')
      .then((snapshot) => {
        const allReadings = snapshot.val();
        console.log("inside read sensor",allReadings);
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

app.get("/dashboard",async function(req, res){
  const readings = await read_sensor();
  const { temperatureArray, humidityArray, moistureArray } = await fetchChartData();
  res.render("dashboard",{readings:readings,temperature:temperatureArray, humidity:humidityArray, moisture:moistureArray});
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
    //console.log("Inside", reading);
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

app.post("/register",async function(req, res)
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
    const readings = await read_sensor();
      const { temperatureArray, humidityArray, moistureArray } = await fetchChartData();
      res.render("dashboard",{readings:readings,temperature:temperatureArray, humidity:humidityArray, moisture:moistureArray});
  } catch (err) {
    console.log(err);
  }
  const readings = await read_sensor();
  const { temperatureArray, humidityArray, moistureArray } = await fetchChartData();
  res.render("dashboard",{readings:readings,temperature:temperatureArray, humidity:humidityArray, moisture:moistureArray});
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
      const { temperatureArray, humidityArray, moistureArray } = await fetchChartData();
      res.render("dashboard",{readings:readings,temperature:temperatureArray, humidity:humidityArray, moisture:moistureArray});
      console.log(temperatureArray,humidityArray,moistureArray);
    } else {
      // Username or password is incorrect
      res.status(401).send("Invalid username or password");
    }
  } catch (err) {
    console.error(err);
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
      //console.log(currentDate);
    // Calculate the future date by adding 24 hours (86400000 milliseconds)
      const futureDate = new Date(currentDate.getTime() + 86400000);
      //console.log(futureDate);
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
    //console.log(title,quantity,amount,address);
  })

