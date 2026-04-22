const { DataTypes } = require('sequelize');
const sequelize = require('./index');

const Product = sequelize.define('Product', {
  id: {
    type: DataTypes.STRING, // Since old data uses 'p2', 'p3' etc.
    primaryKey: true,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  price: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  img: {
    type: DataTypes.TEXT,
  },
  category: {
    type: DataTypes.STRING,
  }
}, {
  tableName: 'products'
});

module.exports = Product;
