#!/usr/bin/env bash
# Swap which app variant owns ios/ — without destroying the other one.
#
# `expo prebuild` always writes to ./ios, so the rider and driver native
# projects overwrite each other. This parks the current project as
# ios-<variant>/ before restoring the requested one, so each keeps its Pods and
# build output and a switch costs a rename instead of a fresh pod install.
#
#   scripts/ios-variant.sh rider
#   scripts/ios-variant.sh driver

set -euo pipefail
cd "$(dirname "$0")/.."

target="${1:-}"
case "$target" in
  rider|driver) ;;
  *) echo "usage: ${0##*/} rider|driver" >&2; exit 1 ;;
esac

# Which variant currently occupies ios/. The marker file is authoritative;
# the .xcodeproj name is the fallback for a project made before this script.
detect_current() {
  if [ -f ios/.variant ]; then cat ios/.variant; return; fi
  if [ -d ios/WheelersDriver.xcodeproj ]; then echo driver; return; fi
  if [ -d ios/Wheelers.xcodeproj ]; then echo rider; return; fi
  echo ""
}

if [ -d ios ]; then
  current="$(detect_current)"

  if [ "$current" = "$target" ]; then
    echo "ios/ already holds the $target project — nothing to do."
    exit 0
  fi

  if [ -n "$current" ]; then
    rm -rf "ios-$current"
    mv ios "ios-$current"
    echo "parked the $current project at ios-$current/"
  else
    echo "ios/ holds an unrecognised project — parking it at ios-unknown/" >&2
    rm -rf ios-unknown
    mv ios ios-unknown
  fi
fi

if [ -d "ios-$target" ]; then
  mv "ios-$target" ios
  echo "$target" > ios/.variant
  echo "restored the $target project into ios/ — ready to build."
else
  echo "no cached project for $target — prebuilding one (this takes a while)..."
  APP_VARIANT="$target" EXPO_PUBLIC_APP_VARIANT="$target" \
    npx expo prebuild --platform ios --clean --no-install
  ( cd ios && pod install )
  echo "$target" > ios/.variant
  echo "prebuilt the $target project into ios/ — ready to build."
fi
