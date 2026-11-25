require 'xcodeproj'
require 'fileutils'
project = Xcodeproj::Project.open('ios/App/App.xcodeproj')
app = project.targets.find { |target| target.name == 'App' }
test = project.new_target(:unit_test_bundle, 'SpellfulIntegration', :ios, '15.0')
test.add_dependency(app)
group = project.main_group.new_group('SpellfulIntegration', 'SpellfulIntegration')
FileUtils.mkdir_p('ios/App/SpellfulIntegration')
%w[SpellfulIntegration.swift messaging.js purchases.js Spellful.storekit].each { |f| FileUtils.cp("qa/ios/#{f}", "ios/App/SpellfulIntegration/#{f}") }
fixtures = ENV['SPELLFUL_QA_FIXTURES']
FileUtils.cp(fixtures, 'ios/App/SpellfulIntegration/accounts.json') if fixtures && File.exist?(fixtures)
test.source_build_phase.add_file_reference(group.new_file('SpellfulIntegration.swift'))
resources = %w[messaging.js purchases.js Spellful.storekit]
resources << 'accounts.json' if fixtures && File.exist?(fixtures)
resources.each { |f| test.resources_build_phase.add_file_reference(group.new_file(f)) }
test.build_configurations.each do |config|
  config.build_settings.merge!({'PRODUCT_NAME'=>'SpellfulIntegration','EXECUTABLE_NAME'=>'SpellfulIntegration','GENERATE_INFOPLIST_FILE'=>'YES','SWIFT_VERSION'=>'5.0','PRODUCT_BUNDLE_IDENTIFIER'=>'com.spellful.app.integrationtests','TEST_HOST'=>'$(BUILT_PRODUCTS_DIR)/App.app/App','BUNDLE_LOADER'=>'$(TEST_HOST)'})
end
project.save
scheme = Xcodeproj::XCScheme.new
scheme.configure_with_targets(app, test)
scheme.save_as(project.path, 'SpellfulIntegration', true)
