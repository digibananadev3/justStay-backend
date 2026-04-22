import express from "express";
import dashboardRoutes from "./dashboard.routes.js";
import guestsRoutes from "./guests.routes.js";
import propertyRoutes from "./properties.routes.js";
import propertyTypeRoutes from "./propertyType.routes.js";
import propertyListTypeRoutes from "./propertyListType.routes.js";
import verificationRoutes from "./verification.routes.js";
import bookingManagerRoutes from "./bookingManager.routes.js";
import amenitiesRoutes from "./amenities.routes.js";
import roomTypesRoutes from "./roomTypes.routes.js";
import offerRoutes from "./offer.routes.js";

const router = express.Router();

// Core routes
router.get('/home',(req,res)=>{
    res.json({
        message:"hii"
    })
})
router.use("/", dashboardRoutes); // /overview
router.use("/guests", guestsRoutes);
router.use('/properties', propertyRoutes);
router.use('/property-types', propertyTypeRoutes);
router.use('/property-list-types', propertyListTypeRoutes);
router.use('/verification', verificationRoutes);
router.use('/bookings', bookingManagerRoutes);
router.use('/amenities', amenitiesRoutes);
router.use('/room-types', roomTypesRoutes);
router.use('/offers', offerRoutes);


export default router;
