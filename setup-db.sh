#!/bin/bash
# Script para ejecutar el schema en Turso

cd /mnt/d/GlobalDev-Clientes/Percy/lms-platform-basic
/home/devsosis99/.turso/turso db shell database-fuchsia-window-vercel-icfg-cxhzpwcsrz7ol8hgkzy5iaun < schema.sql
