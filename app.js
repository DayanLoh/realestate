const express = require('express'); 
const mysql = require('mysql2'); 
const multer = require('multer');
const fs = require('fs'); 
const { connect } = require('http2');
const app = express(); 

// Create MySQL connection 
const connection = mysql.createConnection({ 
  host: 'mysql-dayan.alwaysdata.net', 
  user: 'dayan', 
  password: 'Republicpoly12345', 
  database: 'dayan_project' 
}); 

connection.connect((err) => { 
  if (err) { 
    console.error('Error connecting to MySQL:', err); 
    return; 
  } 
  console.log('Connected to MySQL database'); 
}); 

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/images'); // Directory to save uploaded files
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname); // File name to save
  }
});
const upload = multer({ storage: storage });

// Set up view engine 
app.set('view engine', 'ejs'); 
app.use(express.static('public')); 
app.use(express.urlencoded({ extended: false })); 

// Route for Index
app.get('/', (req, res) => {
    res.render('index');
});

// Login route
app.get('/login', (req, res) => {
  res.render('login');
});

// Registration route
app.get('/register', (req, res) => {
  res.render('register');
});

// Handle login post
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const sql = 'SELECT * FROM user WHERE username = ? AND password = ?';
  
  connection.query(sql, [username, password], (error, results) => {
    if (error) {
      console.error('Database query error:', error.message);
      return res.status(500).send('Error logging in');
    }
    if (results.length > 0) {
      const userId = results[0].user_id; 
      if (username === "admin" && password === "admin") {
        res.redirect('/staff'); 
      } else {
        res.redirect(`/user/${userId}`); 
      }
    } else {
      res.status(401).send('Invalid username or password');
    }
  });
});

// Handle registration post
app.post('/register', (req, res) => {
  const { username, password, email } = req.body;
  const sql = 'INSERT INTO user (username, password, email, created_at, updated_at) VALUES (?, ?, ?, CURDATE(), CURDATE())';
  
  connection.query(sql, [username, password, email], (error, results) => {
    if (error) {
      console.error('Database insert error:', error.message);
      return res.status(500).send('Error registering user');
    }
    res.redirect('/login'); 
  });
});

// Staff page route
app.get('/staff', (req, res) => {
  const sql = 'SELECT * FROM property';
  connection.query(sql, (error, results) => {
    if (error) {
      console.error('Database query error:', error.message);
      return res.status(500).send('Error fetching properties');
    }
    res.render('staff', { properties: results });
  });
});

// Create property route
app.get('/staff/create', (req, res) => {
  res.render('create');
});

// Handle property creation
app.post('/staff/create', upload.single('photo'), (req, res) => {
  const { property_type, location, price, bedrooms, bathrooms, square_footage, description } = req.body;
  const photoBlob = req.file ? req.file.filename : null; // Get filename for image

  const sql = 'INSERT INTO property (property_type, location, price, bedrooms, bathrooms, square_footage, description, status, photo, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), CURDATE())';

  connection.query(sql, [property_type, location, price, bedrooms, bathrooms, square_footage, description, 100, photoBlob], (error, results) => {
      if (error) {
          console.error('Database insert error:', error.message);
          return res.status(500).send('Error creating property');
      }
      res.redirect('/staff');
  });
});

// Handle property update
app.post('/staff/edit/:id', upload.single('photo'), (req, res) => {
  const propertyId = req.params.id;
  const { property_type, location, price, bedrooms, bathrooms, square_footage, description, status } = req.body;
  let photoBlob = req.body.photo_current; // Get current photo filename or blob

  // Check if a new photo file was uploaded
  if (req.file) {
    photoBlob = req.file.filename; // Update with new photo filename if uploaded
  }

  const sql = 'UPDATE property SET property_type = ?, location = ?, price = ?, bedrooms = ?, bathrooms = ?, square_footage = ?, description = ?, status = ?, photo = ?, updated_at = CURDATE() WHERE property_id = ?';

  connection.query(sql, [property_type, location, price, bedrooms, bathrooms, square_footage, description, status, photoBlob, propertyId], (error, results) => {
    if (error) {
      console.error('Database update error:', error.message);
      return res.status(500).send('Error updating property');
    }
    res.redirect('/staff'); 
  });
});




// Handle property deletion
app.post('/staff/delete/:id', (req, res) => {
  const propertyId = req.params.id;
  const sql = 'DELETE FROM property WHERE property_id = ?';

  connection.query(sql, [propertyId], (error, results) => {
    if (error) {
      console.error('Database delete error:', error.message);
      return res.status(500).send('Error deleting property');
    }
    res.redirect('/staff'); 
  });
});

// Logout route
app.get('/logout', (req, res) => {
  res.redirect('/login'); 
});


// User properties page route
app.get('/user/:id', (req, res) => {
  const userId = req.params.id;
  const sql = 'SELECT * FROM property';

  connection.query(sql, (error, results) => {
    if (error) {
      console.error('Error fetching properties:', error.message);
      return res.status(500).send('Error fetching properties');
    }
    res.render('user', { properties: results, userId: userId });
  });
});

// Route to render the edit property form
app.get('/staff/edit/:id', (req, res) => {
  const propertyId = req.params.id;
  const sql = 'SELECT * FROM property WHERE property_id = ?';

  connection.query(sql, [propertyId], (error, results) => {
    if (error) {
      console.error('Database query error:', error.message);
      return res.status(500).send('Error fetching property details');
    }

    if (results.length === 0) {
      return res.status(404).send('Property not found');
    }

    const property = results[0];
    res.render('edit', { property });
  });
});


// Handle search/filter
app.post('/user/:id/search', (req, res) => {
  const { location, minPrice, maxPrice } = req.body;
  let sql = 'SELECT * FROM property WHERE 1=1';

  if (location) {
    sql += ' AND location LIKE ?';
  }
  if (minPrice) {
    sql += ' AND price >= ?';
  }
  if (maxPrice) {
    sql += ' AND price <= ?';
  }

  const params = [];
  if (location) params.push(`%${location}%`);
  if (minPrice) params.push(minPrice);
  if (maxPrice) params.push(maxPrice);

  connection.query(sql, params, (error, results) => {
    if (error) {
      console.error('Error fetching filtered properties:', error.message);
      return res.status(500).send('Error fetching properties');
    }
    res.render('user', { properties: results, userId: req.params.id });
  });
});

app.post('/user/:userId/buy/:propertyId', (req, res) => {
  const { userId, propertyId } = req.params;
  const percentage = parseFloat(req.body.percentage); // Ensure percentage is a float

  // Fetch the current property details
  connection.query('SELECT price, status FROM property WHERE property_id = ?', [propertyId], (err, results) => {
    if (err) {
      console.error('Error fetching property details:', err);
      return res.status(500).send('Error fetching property details');
    }

    if (results.length === 0) {
      return res.status(404).send('Property not found');
    }

    const property = results[0];
    const propertyPrice = property.price;
    const newStatus = property.status - percentage;

    // Check if the user already has a percentage of the property
    const checkUserSql = 'SELECT * FROM propertyuserbuy WHERE user_id = ? AND property_id = ?';
    connection.query(checkUserSql, [userId, propertyId], (checkError, userResults) => {
      if (checkError) {
        console.error('Error checking user-property relationship:', checkError);
        return res.status(500).send('Error processing purchase');
      }

      let query, queryParams;

      if (userResults.length > 0) {
        // User already has a percentage, update the existing record
        const existingPercentage = userResults[0].percentage;
        const updatedPercentage = existingPercentage + percentage;

        query = 'UPDATE propertyuserbuy SET percentage = ? WHERE user_id = ? AND property_id = ?';
        queryParams = [updatedPercentage, userId, propertyId];
      } else {
        // User does not have a percentage, insert a new record
        query = 'INSERT INTO propertyuserbuy (user_id, property_id, percentage) VALUES (?, ?, ?)';
        queryParams = [userId, propertyId, percentage];
      }

      // Update the property status and user percentage
      connection.beginTransaction((transactionErr) => {
        if (transactionErr) {
          console.error('Transaction error:', transactionErr);
          return res.status(500).send('Transaction error');
        }

        connection.query('UPDATE property SET status = ? WHERE property_id = ?', [newStatus, propertyId], (updateError) => {
          if (updateError) {
            return connection.rollback(() => {
              console.error('Error updating property status:', updateError);
              res.status(500).send('Error processing purchase');
            });
          }

          connection.query(query, queryParams, (insertUpdateError) => {
            if (insertUpdateError) {
              return connection.rollback(() => {
                console.error('Error updating/inserting user purchase:', insertUpdateError);
                res.status(500).send('Error processing purchase');
              });
            }

            connection.commit((commitErr) => {
              if (commitErr) {
                return connection.rollback(() => {
                  console.error('Transaction commit error:', commitErr);
                  res.status(500).send('Transaction commit error');
                });
              }

              // Redirect back to the user properties page
              res.redirect(`/user/${userId}`);
            });
          });
        });
      });
    });
  });
});


// Serve property images
app.get('/image/:id', (req, res) => {
  const propertyId = req.params.id;
  const sql = 'SELECT photo FROM property WHERE property_id = ?';

  connection.query(sql, [propertyId], (error, results) => {
    if (error) {
      console.error('Error fetching image:', error.message);
      return res.status(500).send('Error fetching image');
    }
    if (results.length > 0) {
      const imageBlob = results[0].photo;
      res.sendFile(__dirname + '/public/images/' + imageBlob); 
    } else {
      res.status(404).send('Image not found');
    }
  });
});

app.get('/user/:userId/buy/:propertyId', (req, res) => {
  const userId = req.params.userId;
  const propertyId = req.params.propertyId;
  const percentage = req.query.percentage; // Get the percentage from query parameters

  // Fetch the current property details
  connection.query('SELECT price, status FROM property WHERE property_id = ?', [propertyId], (err, results) => {
    if (err) throw err;

    if (results.length === 0) {
      return res.status(404).send('Property not found');
    }

    const property = results[0];
    const propertyPrice = property.price;

    // Calculate the new status based on the percentage
    const amountToDeduct = (propertyPrice * (percentage / 100));
    const newStatus = (property.status - percentage); // Update status logic here

    // Update the property status
    connection.query('UPDATE property SET status = ? WHERE property_id = ?', [newStatus, propertyId], (error) => {
      if (error) {
        console.error('Error updating property status:', error);
        return res.status(500).send('Error processing purchase');
      }
      
      // Redirect to the user properties page
      res.redirect(`/user/${userId}`);
    });
  });
});

app.get('/user/:userId/manage', (req, res) => {
  const userId = req.params.userId;

  // Query to fetch properties owned by the user along with their purchase percentages
  const propertyQuery = `
    SELECT p.*, pub.percentage 
    FROM property p 
    JOIN propertyuserbuy pub ON p.property_id = pub.property_id 
    WHERE pub.user_id = ?
  `;

  connection.query(propertyQuery, [userId], (err, property) => {
    if (err) {
      console.error('Error fetching property:', err);
      return res.status(500).send('Error fetching property');
    }

    // Render the manage.ejs template with the user's properties
    res.render('manage', { userId, property });
  });
});


app.get('/user/:userId/sell/:propertyId', (req, res) => {
  const userId = req.params.userId;
  const propertyId = req.params.propertyId;
  const percentage = req.query.percentage;

  // Fetch property details and logic to update the sell status here
  // For example:
  connection.query('SELECT price, status FROM property WHERE property_id = ?', [propertyId], (err, results) => {
    if (err) throw err;

    if (results.length === 0) {
      return res.status(404).send('Property not found');
    }

    const property = results[0];
    const propertyPrice = property.price;

    // Calculate the new status based on the percentage
    const amountToDeduct = (propertyPrice * (percentage / 100));
    const newStatus = (property.status + parseFloat(percentage)); // Update status logic here

    // Update the property status
    connection.query('UPDATE property SET status = ? WHERE property_id = ?', [newStatus, propertyId], (error) => {
      if (error) {
        console.error('Error updating property status:', error);
        return res.status(500).send('Error processing sale');
      }
      
      // Redirect back to the manage page
      res.redirect(`/user/${userId}/manage`);
    });
  });
});

// POST route to handle property sale
app.post('/user/:userId/sell/:propertyId', (req, res) => {
  const { userId, propertyId } = req.params;
  const { percentage } = req.body;

  // Fetch the current property details
  connection.query('SELECT price, status FROM property WHERE property_id = ?', [propertyId], (err, results) => {
    if (err) {
      console.error('Error fetching property details:', err);
      return res.status(500).send('Error fetching property details');
    }

    if (results.length === 0) {
      return res.status(404).send('Property not found');
    }

    const property = results[0];
    
    // Calculate the new status
    const newStatus = property.status + parseInt(percentage); // Assuming status represents available percentage

    // Update the property status
    const updatePropertySql = 'UPDATE property SET status = ? WHERE property_id = ?';
    connection.query(updatePropertySql, [newStatus, propertyId], (updateError) => {
      if (updateError) {
        console.error('Error updating property status:', updateError);
        return res.status(500).send('Error processing sale');
      }

      // Update the propertyuserbuy table
      const updateUserBuySql = 'UPDATE propertyuserbuy SET percentage = percentage - ? WHERE user_id = ? AND property_id = ?';
      connection.query(updateUserBuySql, [percentage, userId, propertyId], (updateUserBuyError) => {
        if (updateUserBuyError) {
          console.error('Error updating propertyuserbuy:', updateUserBuyError);
          return res.status(500).send('Error marking sale');
        }

        // Check if the percentage is now zero
        const checkPercentageSql = 'SELECT percentage FROM propertyuserbuy WHERE user_id = ? AND property_id = ?';
        connection.query(checkPercentageSql, [userId, propertyId], (checkPercentageError, checkPercentageResults) => {
          if (checkPercentageError) {
            console.error('Error checking percentage:', checkPercentageError);
            return res.status(500).send('Error checking sale percentage');
          }

          if (checkPercentageResults.length > 0 && checkPercentageResults[0].percentage <= 0) {
            // Delete the record if the percentage is zero
            const deleteUserBuySql = 'DELETE FROM propertyuserbuy WHERE user_id = ? AND property_id = ?';
            connection.query(deleteUserBuySql, [userId, propertyId], (deleteUserBuyError) => {
              if (deleteUserBuyError) {
                console.error('Error deleting propertyuserbuy record:', deleteUserBuyError);
                return res.status(500).send('Error deleting sale record');
              }

              // Redirect back to the user properties page
              res.redirect(`/user/${userId}/manage`);
            });
          } else {
            // Redirect back to the user properties page
            res.redirect(`/user/${userId}/manage`);
          }
        });
      });
    });
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});