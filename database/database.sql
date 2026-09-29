-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1:3306
-- Generation Time: Sep 29, 2026 at 08:50 AM
-- Server version: 9.1.0
-- PHP Version: 8.3.14

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `graduation_project`
--

-- --------------------------------------------------------

--
-- Table structure for table `dangky`
--

DROP TABLE IF EXISTS `dangky`;
CREATE TABLE IF NOT EXISTS `dangky` (
  `MaDK` int NOT NULL AUTO_INCREMENT,
  `MaSV` varchar(20) NOT NULL,
  `MaDT` varchar(20) NOT NULL,
  `NgayDangKy` date DEFAULT NULL,
  `TrangThai` varchar(50) DEFAULT NULL,
  `Diem` decimal(4,2) DEFAULT NULL,
  PRIMARY KEY (`MaDK`),
  KEY `MaSV` (`MaSV`),
  KEY `MaDT` (`MaDT`)
) ENGINE=MyISAM AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `dangky`
--

INSERT INTO `dangky` (`MaDK`, `MaSV`, `MaDT`, `NgayDangKy`, `TrangThai`, `Diem`) VALUES
(1, 'SV001', 'DT001', '2026-09-18', 'Da dang ky', 8.00),
(2, 'SV002', 'DT002', '2026-09-20', 'Da dang ky', 7.00),
(3, 'SV003', 'DT003', '2026-09-20', 'Cho duyet', NULL),
(4, 'SV004', 'DT004', '2026-09-20', 'Da dang ky', NULL),
(7, 'SV001', 'DT001', '2026-09-27', 'Đang thực hiện', NULL),
(8, 'SV002', 'DT001', '2026-09-27', 'Cho duyet', NULL);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
