*** Settings ***
Documentation     Screenshot generation for Buildly Marketplace
...               Generates canonical screenshots for the marketplace listing
Library           Browser
Library           OperatingSystem
Suite Setup       Setup Screenshot Session
Suite Teardown    Close Browser

*** Variables ***
${BASE_URL}           %{BASE_URL=http://localhost:8000}
${BROWSER}            chromium
${HEADLESS}           true
${SCREENSHOT_DIR}     %{SCREENSHOT_DIR=marketplace/screenshots}
${VIEWPORT_WIDTH}     1280
${VIEWPORT_HEIGHT}    800

*** Keywords ***
Setup Screenshot Session
    [Documentation]    Initialize browser with consistent viewport for screenshots
    # Ensure screenshot directory exists
    Create Directory    ${SCREENSHOT_DIR}
    
    # Launch browser with specific viewport
    New Browser    ${BROWSER}    headless=${HEADLESS}
    New Context    viewport={'width': ${VIEWPORT_WIDTH}, 'height': ${VIEWPORT_HEIGHT}}
    New Page       ${BASE_URL}
    Wait For Elements State    [data-testid="app-root"]    visible    timeout=10s

*** Test Cases ***
Generate Home Screenshot
    [Documentation]    Capture the initial home state
    [Tags]    screenshot    marketplace
    
    # Ensure clean state
    Go To    ${BASE_URL}
    Wait For Elements State    [data-testid="app-root"]    visible
    
    # Small delay to ensure CSS animations complete
    Sleep    500ms
    
    # Capture screenshot
    Take Screenshot    filename=${SCREENSHOT_DIR}/01-home.png    fullPage=false
    
    # Verify file was created
    File Should Exist    ${SCREENSHOT_DIR}/01-home.png

Generate Primary Action Screenshot
    [Documentation]    Capture state after clicking primary action
    [Tags]    screenshot    marketplace
    
    # Start from home
    Go To    ${BASE_URL}
    Wait For Elements State    [data-testid="app-root"]    visible
    
    # Click primary action to reveal panel
    Click    [data-testid="primary-action"]
    Wait For Elements State    [data-testid="panel"]    visible    timeout=5s
    
    # Small delay for animation
    Sleep    500ms
    
    # Capture screenshot
    Take Screenshot    filename=${SCREENSHOT_DIR}/02-primary-action.png    fullPage=false
    
    # Verify file was created
    File Should Exist    ${SCREENSHOT_DIR}/02-primary-action.png
