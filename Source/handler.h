#ifndef HANDLER_H
#define HANDLER_H

#include "defines.h"
#include <vector>
#include <string>
#include <fstream>
#include <stdlib.h>
#include <stdio.h>

#include <QApplication>

class Handler : public QObject
{
    Q_OBJECT
public:
    int curr_device;
    explicit Handler(QObject*);
    virtual ~Handler();
    std::vector<std::string> deviceList;
    std::vector<int> firmwareCount;
    std::vector<std::string*> firmwareList;
    std::vector<std::string> commandList;
    std::vector<std::string> signatureList;

    bool findWorkingDir();
    bool loadConfigFile();
    bool downloadFirmwares();
    bool detectDevice();
    int uploadFirmware(int firmwareIndex);

private:
    void writeLog(std::string);
    void clearLists();
    std::string getCommand();
    bool fileExists(std::string);
    bool downloadFile(std::string file);
};

#endif // HANDLER_H
