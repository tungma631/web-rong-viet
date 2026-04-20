const { DataTypes } = require('sequelize');
const sequelize = require('./index');
const Order = require('./Order');
const Product = require('./Product');

const OrderItem = sequelize.define('OrderItem', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  orderCode: {
    type: DataTypes.BIGINT,
    allowNull: false,
    references: {
      model: Order,
      key: 'orderCode'
    }
  },
  productId: {
    type: DataTypes.STRING,
    allowNull: false,
    references: {
      model: Product,
      key: 'id'
    }
  },
  quantity: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  priceAtPurchase: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, {
  tableName: 'order_items'
});

// Relationships
Order.hasMany(OrderItem, { foreignKey: 'orderCode' });
OrderItem.belongsTo(Order, { foreignKey: 'orderCode' });

Product.hasMany(OrderItem, { foreignKey: 'productId' });
OrderItem.belongsTo(Product, { foreignKey: 'productId' });

module.exports = OrderItem;
