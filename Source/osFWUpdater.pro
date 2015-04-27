#-------------------------------------------------
#
# Project created by QtCreator 2015-04-23T00:16:52
#
#-------------------------------------------------

QT       += core gui

greaterThan(QT_MAJOR_VERSION, 4): QT += widgets serialport network

TARGET = osFWUpdater
TEMPLATE = app


SOURCES += main.cpp\
        mainwindow.cpp \
    handler.cpp

HEADERS  += mainwindow.h \
    handler.h \
    defines.h

FORMS    += mainwindow.ui
