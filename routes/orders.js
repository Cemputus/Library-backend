const express = require("express");
const fs = require("fs");
const router = express.Router();
const uuid = require("uuid");
const path = require("path");

// Helper function to read JSON files with error handling
function readJsonFile(filePath) {
    try {
        const fullPath = path.join(__dirname, '..', filePath);
        if (!fs.existsSync(fullPath)) {
            fs.writeFileSync(fullPath, JSON.stringify([]));
            return [];
        }
        const data = fs.readFileSync(fullPath, 'utf8');
        return data ? JSON.parse(data) : [];
    } catch (error) {
        console.error(`Error reading ${filePath}:`, error);
        return [];
    }
}

// Helper function to write JSON files with error handling
function writeJsonFile(filePath, data) {
    try {
        const fullPath = path.join(__dirname, '..', filePath);
        fs.writeFileSync(fullPath, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error(`Error writing ${filePath}:`, error);
        return false;
    }
}

// Middleware to check if user is admin
function isAdmin(req, res, next) {
    const users = readJsonFile("./data/users.json");
    const user = users.find(u => u.id === req.user?.id);
    
    if (user && user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: "Access denied. Admin privileges required." });
    }
}

// Get all orders (admin only)
router.get("/", isAdmin, function (req, res, next) {
    const orders = readJsonFile("./data/orders.json");
    res.status(200).json(orders);
});

router.get("/:id", function (req, res, next) {
    const orders = readJsonFile("./data/orders.json");
    const order = orders.find((order) => order.id == req.params.id);
    if (order) {
        res.status(200).json(order);
    } else {
        res.status(404).json({ message: "Order not found" });
    }
});

router.get("/user/:id", function (req, res, next) {
    const orders = readJsonFile("./data/orders.json");
    const userOrders = orders.filter((order) => order.user_id == req.params.id);
    res.status(200).json(userOrders);
});

router.post("/", function (req, res, next) {
    try {
        // Read files with error handling
        const orders = readJsonFile("./data/orders.json");
        const users = readJsonFile("./data/users.json");
        const products = readJsonFile("./data/books.json");

        // Check if request body exists
        if (!req.body) {
            return res.status(400).json({ message: "No order data provided" });
        }

        const user = users.find((user) => user.id == req.body.user_id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const order = {
            id: uuid.v1(),
            user_id: user.id,
            name: user.name,
            email: user.email,
            delivery_address: req.body.delivery_address,
            billing_address: req.body.billing_address,
            phone: user.phone,
            items: req.body.items,
            payment: "card",
            date: new Date().toISOString(),
            total: req.body.total,
            status: 'pending'
        };

        if (validateOrder(order)) {
            orders.push(order);
            
            // Update product quantities
            for (const item of req.body.items) {
                const book = products.find((product) => product.id == item.id);
                if (book) {
                    book.quantity = Math.max(0, book.quantity - item.quantity);
                }
            }

            // Save changes
            if (writeJsonFile("./data/orders.json", orders) && 
                writeJsonFile("./data/books.json", products)) {
                res.status(201).json({ 
                    message: "Order created successfully", 
                    order: order 
                });
            } else {
                res.status(500).json({ message: "Error saving order data" });
            }
        } else {
            res.status(400).json({ message: "Invalid order data" });
        }
    } catch (error) {
        console.error("Error in POST /orders:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

router.delete("/:id", function (req, res) {
    const orders = readJsonFile("./data/orders.json");
    const order = orders.find((order) => order.id == req.params.id);
    if (order) {
        const updatedOrders = orders.filter((order) => order.id != req.params.id);
        if (writeJsonFile("./data/orders.json", updatedOrders)) {
            res.status(200).json({
                message: `Order ${req.params.id} deleted successfully`
            });
        } else {
            res.status(500).json({ message: "Error deleting order" });
        }
    } else {
        res.status(404).json({ message: "Order not found" });
    }
});

function validateOrder(order) {
    const regexLetters = /(^[A-Za-z]{2,30})/;
    const regexZipCode = /^[0-9]{6}$/;
    const regexAddressSuite = /^[.0-9a-zA-Z\s,-]+$/;

    return (
        order.delivery_address &&
        order.delivery_address.street &&
        order.delivery_address.suite &&
        order.delivery_address.city &&
        order.delivery_address.zipcode &&
        order.billing_address &&
        order.billing_address.street &&
        order.billing_address.suite &&
        order.billing_address.city &&
        order.billing_address.zipcode &&
        order.items &&
        order.items.length > 0 &&
        order.delivery_address.street.length >= 1 &&
        order.delivery_address.street.length <= 30 &&
        order.billing_address.street.length >= 1 &&
        order.billing_address.street.length <= 30 &&
        order.delivery_address.city.match(regexLetters) &&
        order.delivery_address.city.length >= 1 &&
        order.delivery_address.city.length <= 30 &&
        order.billing_address.city.match(regexLetters) &&
        order.billing_address.city.length >= 1 &&
        order.billing_address.city.length <= 30 &&
        order.delivery_address.suite.match(regexAddressSuite) &&
        order.billing_address.suite.match(regexAddressSuite) &&
        order.delivery_address.zipcode.match(regexZipCode) &&
        order.billing_address.zipcode.match(regexZipCode)
    );
}

module.exports = router;
