CREATE TABLE `cohorts` (
  `cohort_code` varchar(200) NOT NULL DEFAULT '',
  `anonymous_link` varchar(200) DEFAULT NULL,
  PRIMARY KEY (`cohort_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE `map` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `token` varchar(200) NOT NULL DEFAULT '',
  `cohort_code` varchar(200) NOT NULL,
  `link` varchar(200) NOT NULL DEFAULT '',
  `link_expiration` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `token-cohort-created` (`token`,`cohort_code`,`created`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8;
