-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1:3306
-- Generation Time: Sep 28, 2026 at 10:09 AM
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
  PRIMARY KEY (`MaDK`),
  KEY `MaSV` (`MaSV`),
  KEY `MaDT` (`MaDT`)
) ENGINE=MyISAM AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `dangky`
--

INSERT INTO `dangky` (`MaDK`, `MaSV`, `MaDT`, `NgayDangKy`, `TrangThai`) VALUES
(1, 'SV001', 'DT001', '2026-09-21', 'Da dang ky'),
(2, 'SV002', 'DT002', '2026-09-21', 'Da dang ky'),
(3, 'SV003', 'DT003', '2026-09-20', 'Cho duyet'),
(4, 'SV004', 'DT004', '2026-09-20', 'Da dang ky'),
(7, 'SV001', 'DT001', '2026-09-27', 'Đang thực hiện'),
(8, 'SV002', 'DT001', '2026-09-27', 'Cho duyet');

-- --------------------------------------------------------

--
-- Table structure for table `detai`
--

DROP TABLE IF EXISTS `detai`;
CREATE TABLE IF NOT EXISTS `detai` (
  `MaDT` varchar(20) NOT NULL,
  `TenDT` varchar(200) NOT NULL,
  `MoTa` text,
  `GiangVienHuongDan` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`MaDT`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `detai`
--

INSERT INTO `detai` (`MaDT`, `TenDT`, `MoTa`, `GiangVienHuongDan`) VALUES
('DT001', 'Xay dung he thong quan ly do an tot nghiep', 'Quan ly sinh vien, de tai va dang ky de tai ne', 'Nguyen Van A'),
('DT002', 'Xay dung website ban hang', 'Website thuong mai dien tu co quan ly san pham', 'Tran Van B'),
('DT003', 'Ung dung quan ly thu vien', 'Quan ly sach, doc gia va muon tra sach', 'Le Van C'),
('DT004', 'He thong quan ly phong tro', 'Quan ly phong, khach thue va hop dong', 'Pham Van D'),
('DT005', 'Xay dung website ban quan ao', 'ban quan ao', 'Le Van D');

-- --------------------------------------------------------

--
-- Table structure for table `sinhvien`
--

DROP TABLE IF EXISTS `sinhvien`;
CREATE TABLE IF NOT EXISTS `sinhvien` (
  `MaSV` varchar(20) NOT NULL,
  `HoTen` varchar(100) NOT NULL,
  `Email` varchar(100) DEFAULT NULL,
  `Lop` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`MaSV`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `sinhvien`
--

INSERT INTO `sinhvien` (`MaSV`, `HoTen`, `Email`, `Lop`) VALUES
('SV002', 'Tran Thi Binh', 'binh@gmail.com', 'CNTT01'),
('SV003', 'Le Van Cuong', 'cuong@gmail.com', 'CNTT02'),
('SV004', 'Pham Thi Dung', 'dung@gmail.com', 'CNTT02'),
('SV005', 'Hoang Van Em', 'em@gmail.com', 'CNTT03'),
('SV001', 'Huỳnh Gia Kiệt1', 'bebau50761@gmail.com', 'CNTT063'),
('SV006', 'Huỳnh Gia Kiệt', 'bebau5076@gmail.com', 'CNTT06');
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
