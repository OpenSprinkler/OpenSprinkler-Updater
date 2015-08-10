system_profiler SPUSBDataType | awk '
	/Product ID:/{p=$3}
	/Vendor ID:/{v=$3}
	/Manufacturer:/{sub(/.*: /,""); m=$0}
	/Location ID:/{sub(/.*: /,"");
	printf("%s:%s:%s\n", v, p, $0);}'
