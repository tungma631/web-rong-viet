const { DataTypes } = require('sequelize');
const sequelize = require('./index');
const User = require('./User'); // Import User for relation

const Order = sequelize.define('Order', {
  orderCode: {
    type: DataTypes.BIGINT, // PayOS orderCode is a number up to 53 bits
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  },
  shippingName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  shippingPhone: {
    type: DataTypes.STRING,
    allowNull: false
  },
  shippingAddress: {
    type: DataTypes.STRING,
    allowNull: false
  },
  totalAmount: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'PENDING'
  }
}, {
  tableName: 'orders'
});

// Define Relationships
User.hasMany(Order, { foreignKey: 'userId' });
Order.belongsTo(User, { foreignKey: 'userId' });

module.exports = Order;
