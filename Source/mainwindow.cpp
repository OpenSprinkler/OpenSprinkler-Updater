#include "mainwindow.h"
#include "ui_mainwindow.h"

MainWindow::MainWindow(QWidget *parent) :
    QMainWindow(parent),
    ui(new Ui::MainWindow)
{
    ui->setupUi(this);

    myHandler = new Handler(this);
    if(myHandler->findWorkingDir()){
        on_btnHelp_clicked();
        if(!myHandler->loadConfigFile()){
            ui->outputBox->setText("Failed to load " FWCONFIG_FILENAME);
            return;
        }
        populateMenus();
    } else {
        ui->outputBox->setText("Error: missing " FWCONFIG_FILENAME);
        this->setEnabled(false);
    }
    this->setWindowIcon(QIcon("icon.png"));
    isPopulating = false;
}

MainWindow::~MainWindow()
{
    delete myHandler;
    delete ui;
}

void MainWindow::on_btnDetect_clicked()
{
    ui->outputBox->setText("Detecting device...");
    if(!myHandler->detectDevice()){
        ui->cmbDevice->setCurrentIndex(0);
        ui->outputBox->append("Failed.\n");
        ui->outputBox->append("Make sure you've installed the necessary driver.\n");
        ui->outputBox->append("For OpenSprinkler Hardware v2.1, make sure the device is in bootloader mode.\n");
        ui->outputBox->append("Check Instructions.pdf for additional details.");
    } else {
        QString dname= myHandler->deviceList[myHandler->curr_device].c_str();
        ui->outputBox->append("Found " + dname + "!\n");

        if (dname.endsWith("2.1")) {
            ui->outputBox->append("Please re-enter bootloader and then click on 'Upload Selected Firmware'.");
        } else {
            ui->outputBox->append("Next, click on 'Upload Selected Firmware'.");
        }
        ui->cmbDevice->setCurrentIndex(myHandler->curr_device);
        ui->cmbDevice->currentIndexChanged(myHandler->curr_device);
    }

}

void MainWindow::on_btnDownload_clicked()
{
    ui->outputBox->setText("Downloading firmware.\nPlease wait...");
    //QApplication::setOverrideCursor(Qt::WaitCursor);
    this->setEnabled(false);
    if(!myHandler->downloadFirmwares()){
        ui->outputBox->append("Error. Check log.txt for details.");
    } else {
        ui->outputBox->append("Success!");
    }

    populateMenus();
    this->setEnabled(true);
    //QApplication::restoreOverrideCursor();
}

void MainWindow::on_btnUpload_clicked()
{
    ui->outputBox->clear();
    if (!myHandler->curr_device) {
        ui->outputBox->setText("Please select a device first.");
        return;
    }
    ui->outputBox->setText("Uploading firmware.\nPlease wait...");
    QApplication::setOverrideCursor(Qt::WaitCursor);
    this->setEnabled(false);
    int ret = myHandler->uploadFirmware(ui->cmbFirmware->currentIndex());
    if(ret){
        ui->outputBox->append("Failed.\n");
        switch(ret) {
        case ERROR_COMMAND:
            ui->outputBox->append("avrdude command error.\n");
            break;
        case ERROR_NO_DEVICE:
            ui->outputBox->append("No device is selected.\n");
            break;
        case ERROR_UPLOADING:
            ui->outputBox->append("Device not found.\n");
            break;
        }
        ui->outputBox->append("Check log.txt for details");
    } else {
        ui->outputBox->append("Success!");
    }
    this->setEnabled(true);
    QApplication::restoreOverrideCursor();
}

void MainWindow::on_btnHelp_clicked()
{
    ui->outputBox->setText("0. Read Instructions.pdf.\n");
    ui->outputBox->append("1. Click 'Download Firmware'.\n");
    ui->outputBox->append("2. For OpenSprinkler Hardware v2.1, please enter bootloader first: details are in Instructions.pdf.\n");
    ui->outputBox->append("For all other hardware versions: just plug in the USB cable.\n");
    ui->outputBox->append("3. Click 'Detect Hardware'.\n");
    ui->outputBox->append("(Release Date: 04/26/15)");
}

void MainWindow::populateMenus()
{
    populateDevices();
    //populateFirmwares(ui->cmbDevice->currentIndex());
}

void MainWindow::populateDevices()
{
    isPopulating = true;
    ui->cmbDevice->clear();
    QStringList list;
    for(unsigned int i = 0; i < myHandler->deviceList.size(); i++){
        list.append(myHandler->deviceList[i].c_str());
    }
    ui->cmbDevice->addItems(list);
    ui->cmbDevice->setCurrentIndex(0);
    isPopulating = false;
    on_cmbDevice_currentIndexChanged(0);
}

void MainWindow::populateFirmwares(int index)
{
    ui->cmbFirmware->clear();
    QStringList list;
    for(int i = 0; i < myHandler->firmwareCount[index]; i++){
        list.append(myHandler->firmwareList[index][i].c_str());
    }
    ui->cmbFirmware->addItems(list);
}

void MainWindow::on_cmbDevice_currentIndexChanged(int index)
{
    if (!isPopulating) {
        myHandler->curr_device = index;
        populateFirmwares(index);
    }
}
