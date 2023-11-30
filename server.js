import express from 'express';
import mysql, { createPool } from 'mysql2';
import cors from 'cors';
import 'dotenv/config'
//import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import fs from 'fs';


import multer from 'multer';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/images/'); // Specify the directory where uploaded image files will be stored
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const fileExtension = path.extname(file.originalname).toLowerCase();

    // Check if the file is an image
    if (['.png', '.jpg', '.jpeg', '.gif'].includes(fileExtension)) {
      cb(null, file.fieldname + '-' + uniqueSuffix + fileExtension);
    } else {
      cb(new Error('Invalid file type'), null);
    }
  },
});

const upload = multer({ storage: storage });

const app = express();

// const apiProxy = createProxyMiddleware('/api', {
//   target: 'https://localhost:5000',
//   changeOrigin: true,
// });

app.use(cors());
app.use(express.json());
app.use('/images', express.static(path.join(__dirname, 'public', 'images')));


// app.use(function(req, res, next) {
//   res.header('Access-Control-Allow-Origin', 'https://localhost:5000');
//   res.header(
//     'Access-Control-Allow-Headers',
//     'Origin, X-Requested-With, Content-Type, Accept'
//   );
//   next();
// });

app.use(
  cors({
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  }),
);

// app.use(
//   cors({
//     origin: 'https://www.my0x.co',
//     methods: ['GET', 'POST', 'PUT', 'DELETE'],
//     credentials: true,
//   }),
// );

//app.use(apiProxy);



const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
 //socketPath: '/Applications/XAMPP/xamppfiles/var/mysql/mysql.sock', // Adjust the path to your MySQL socket
});

// Check if the connection was successful
pool.getConnection((err, connection) => {
  if (err) {
    console.error('Error connecting to database:', err);
  } else {
    console.log('Connected to database');
    connection.release();
  }
});

app.get('/api/accounts/check/:email', (req, res) => {
  const email = req.params.email;
  const username = email.split('@')[0];
  const niche = 'your_niche_value'; // Provide the actual niche value
  const uniqueUrl = `/${username}`; // Create the unique URL

  pool.query(
    'SELECT * FROM accounts WHERE email = ?',
    [email],
    (error, results) => {
      if (error) {
        console.error('Error checking account:', error);
        return res
          .status(500)
          .json({ error: 'An error occurred while checking account' });
      }

      if (results.length === 0) {
        // Email not found, create a new account with provided email, niche, and uniqueUrl
        pool.query(
          'INSERT INTO accounts (username, email, niche, uniqueUrl) VALUES (?, ?, ?, ?)',
          [username, email, niche, uniqueUrl],
          (insertError, insertResult) => {
            if (insertError) {
              console.error('Error creating account:', insertError);
              return res
                .status(500)
                .json({ error: 'An error occurred while creating account' });
            }
            res.status(201).json({
              message: 'Account created successfully',
              accountId: insertResult.insertId,
            });
          },
        );
      } else {
        // Email found, respond with account exists message
        res.json({
          message:
            'checked email: new user will be created and if the user already exist the account wont be created.',
          accountId: results[0].id,
        });
      }
    },
  );
});

app.get('/api/accounts/checkusername/:username', (req, res) => {
  const username = req.params.username;

  pool.query(
    'SELECT * FROM accounts WHERE username = ?',
    [username],
    (error, results) => {
      if (error) {
        console.error('Error checking username:', error);
        return res
          .status(500)
          .json({ error: 'An error occurred while checking username' });
      }

      if (results.length === 0) {
        // Username not found
        res.json({ exists: false });
      } else {
        // Username exists
        res.json({ exists: true });
      }
    },
  );
});

app.put('/api/accounts/additionalinfo/:email', upload.single('image'), (req, res) => {
  const email = req.params.email;
    const { username, niche, name, aboutme } = req.body;

    if (!username || !niche || !name) {
      return res
        .status(400)
        .json({ error: 'username, niche, and name are required' });
    }

    const uniqueUrl = `/${username}`;

    // Check if an image was included in the request
    const image = req.file;
    const imageFilename = image ? image.filename : null;

    // Fetch the current image filename from the database
    pool.query(
      'SELECT image FROM accounts WHERE email = ?',
      [email],
      (selectError, selectResult) => {
        if (selectError) {
          console.error('Error fetching current image filename:', selectError);
          return res.status(500).json({
            error: 'An error occurred while fetching current image filename',
          });
        }

        const currentImageFilename = selectResult[0].image;

        // Only update the image field if a new image is provided
        const updatedImageFilename = imageFilename || currentImageFilename;

        // Update the account information including the image field
        pool.query(
          'UPDATE accounts SET username = ?, niche = ?, uniqueUrl = ?, name = ?, aboutme = ?, image = ? WHERE email = ?',
          [
            username,
            niche,
            uniqueUrl,
            name,
            aboutme,
            updatedImageFilename,
            email,
          ],
          (updateError, result) => {
            if (updateError) {
              console.error('Error updating account:', updateError);
              return res
                .status(500)
                .json({ error: 'An error occurred while updating account' });
            }
            res
              .status(200)
              .json({ message: 'Account updated successfully', email: email });
          },
        );
      },
    );
  },
);

app.get('/api/accounts/userdata/:email', (req, res) => {
  const email = req.params.email;

  pool.query(
    'SELECT * FROM accounts WHERE email = ?',
    [email],
    (error, results) => {
      if (error) {
        console.error('Error fetching user data:', error);
        return res
          .status(500)
          .json({ error: 'An error occurred while fetching user data' });
      }

      if (results.length === 0) {
        return res.status(404).json({ error: 'User data not found' });
      }

      const userData = results[0];
      res.json(userData);
    },
  );
});

// Define a route to handle image requests
// app.get('/accounts/image/:imageValue', (req, res) => {
//   const { imageValue } = req.params;

//   // Fetch image data based on imageValue from your database or storage
//   // For example, if you're storing images in a directory, you can use the 'fs' module:
//   const imagePath = `/path/to/images/${imageValue}`;
//   const imageStream = fs.createReadStream(imagePath);

//   // Set appropriate headers
//   res.setHeader('Content-Type', 'image/jpeg'); // Adjust the content type based on your image format
//   res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache the image for a year

//   // Pipe the image stream to the response
//   imageStream.pipe(res);
// });

// app.get('/api/accounts/image/:imageId', async (req, res) => {
//   try {
//     const imageId = req.params.imageId;
//     // Retrieve the image data from your database using the imageId
//     const imageData = await retrieveImageDataById(imageId);

//     // Set the appropriate content type for the image
//     res.contentType('image/jpeg'); // Update content type based on your image format

//     // Send the image data as the response
//     res.send(imageData);
//   } catch (error) {
//     console.error('Error retrieving image:', error);
//     res.status(500).json({ error: 'Error retrieving image' });
//   }
// });


app.get('/api/accounts/image/:imageValue', (req, res) => {
  const { imageValue } = req.params;

  // Construct the image path using the new URL path
  const imagePath = path.join(__dirname, 'public', 'images', imageValue);

  // Check if the image file exists
  if (!fs.existsSync(imagePath)) {
    return res.status(404).json({ error: 'Image not found' });
  }

  // Get the file's stats to check modification time
  const stats = fs.statSync(imagePath);

  // Set appropriate headers based on image file extension
  const contentType = getContentType(imagePath);

  // Set caching headers using ETag
  const etag = stats.mtimeMs.toString();
  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache the image for a year

  // Check if the image has been modified
  if (req.headers['if-none-match'] === etag) {
    return res.status(304).end(); // Not Modified
  }

  // Stream the image with appropriate Content-Type
  res.setHeader('Content-Type', contentType);
  const imageStream = fs.createReadStream(imagePath);
  imageStream.pipe(res);
});

// Helper function to determine Content-Type based on file extension
function getContentType(filePath) {
  const extname = path.extname(filePath).toLowerCase();
  switch (extname) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.gif':
      return 'image/gif';
    // Add more cases for other image formats as needed
    default:
      return 'application/octet-stream'; // Default to binary if the format is unknown
  }
}



app.get('/api/accounts/image/:imageId', async (req, res) => {
  try {
    const imageId = req.params.imageId;
    // Retrieve the image data from your database using the imageId
    const imageData = await retrieveImageDataById(imageId);

    // Set the appropriate content type for the image
    res.contentType('image/jpeg'); // Update content type based on your image format

    // Send the image data as the response
    res.send(imageData);
  } catch (error) {
    console.error('Error retrieving image:', error);
    res.status(500).json({ error: 'Error retrieving image' });
  }
});

app.post('/api/accounts/rewardlink/:email', (req, res) => {
  const email = req.params.email;
  const { customLinks } = req.body; // Assuming customLinks is an array of link objects

  // Map the received customLinks array to the normalizedLinks array with types
  const normalizedLinks = customLinks.map((link) => ({
    type: link.type,
    link: link.link,
  }));

  try {
    pool.query(
      'UPDATE accounts SET reward_links = ? WHERE email = ?',
      [JSON.stringify(normalizedLinks), email],
      (error, result) => {
        if (error) {
          console.error('Error updating reward links:', error);
          res
            .status(500)
            .json({ error: 'An error occurred while updating reward links' });
        } else {
          res.json({ message: 'Reward links updated successfully' });
        }
      },
    );
  } catch (error) {
    console.error('Error updating reward links:', error);
    res.status(400).json({ error: 'Invalid request' });
  }
});

// Endpoint to get reward links for a specific user
app.get('/api/accounts/getrewardlink/:email', (req, res) => {
  const email = req.params.email;

  pool.query(
    'SELECT COALESCE(reward_links, "[]") AS reward_links FROM accounts WHERE email = ?',
    [email],
    (error, result) => {
      if (error) {
        console.error('Error fetching reward links:', error);
        res
          .status(500)
          .json({ error: 'An error occurred while fetching reward links' });
      } else {
        try {
          const rewardLinks = JSON.parse(result[0].reward_links);

          // Create an object to store links by type
          const linksByType = {};
          rewardLinks.forEach((link) => {
            linksByType[link.type] = link.link;
          });

          res.json(linksByType);
        } catch (parseError) {
          console.error('Error parsing reward links:', parseError);
          res
            .status(500)
            .json({ error: 'An error occurred while parsing reward links' });
        }
      }
    },
  );
});

app.get('/api/accounts/getsecondarylink/:email', (req, res) => {
  const email = req.params.email;

  pool.query(
    'SELECT COALESCE(secondary_links, "[]") AS secondary_links FROM accounts WHERE email = ?',
    [email],
    (error, result) => {
      if (error) {
        console.error('Error fetching secondary links:', error);
        res
          .status(500)
          .json({ error: 'An error occurred while fetching secondary links' });
      } else {
        try {
          const secondaryLinks = JSON.parse(result[0].secondary_links);
          res.json(secondaryLinks);
        } catch (parseError) {
          console.error('Error parsing secondary links:', parseError);
          res
            .status(500)
            .json({ error: 'An error occurred while parsing secondary links' });
        }
      }
    },
  );
});

// POST endpoint to update secondary custom links
app.post('/api/accounts/secondarylink/:email', (req, res) => {
  const email = req.params.email;
  const { Links } = req.body;

  // Map the received Links array to the normalizedLinks array with types
  const normalizedLinks = Links.map((link) => ({
    type: link.type,
    link: link.link,
  }));

  try {
    pool.query(
      'UPDATE accounts SET secondary_links = ? WHERE email = ?',
      [JSON.stringify(normalizedLinks), email],
      (error, result) => {
        if (error) {
          console.error('Error updating secondary custom links:', error);
          res.status(500).json({
            error: 'An error occurred while updating secondary custom links',
          });
        } else {
          res.json({ message: 'Secondary custom links updated successfully' });
        }
      },
    );
  } catch (error) {
    console.error('Error updating secondary custom links:', error);
    res.status(400).json({ error: 'Invalid request' });
  }
});

app.get('/api/accounts/getuserdatadetails', (req, res) => {
  try {
    pool.query(
      'SELECT username, image, name, niche, aboutme, reward_links, secondary_links, ecommerce FROM accounts',
      (error, results) => {
        if (error) {
          console.error('Error fetching user data:', error);
          res.status(500).json({ error: 'Error fetching user data' });
        } else {
          const userData = results.map((row) => ({
            username: row.username,
            image: row.image,
            name: row.name,
            niche: row.niche,
            aboutme: row.aboutme,
            reward_links: JSON.parse(row.reward_links),
            secondary_links: JSON.parse(row.secondary_links),
            ecommerce: row.ecommerce, // Include the ecommerce flag
          }));
          res.status(200).json(userData);
        }
      },
    );
  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).json({ error: 'Error fetching user data' });
  }
});




const PORT = process.env.PORT || 5000; // Use environment variable if available, or default to 3000

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
